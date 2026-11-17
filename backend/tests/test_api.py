from datetime import date

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("JOBPROGRESS_DB", str(tmp_path / "test.db"))
    from main import app

    with TestClient(app) as c:
        yield c


def make(client, **overrides):
    body = {"company": "Acme", "role": "Engineer", **overrides}
    res = client.post("/api/jobs", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_create_and_list(client):
    job = make(client, url="acme.wd5.myworkdayjobs.com/job/1", date_applied="2026-11-01", notes="  hi  ")
    assert job["url"] == "https://acme.wd5.myworkdayjobs.com/job/1"
    assert job["notes"] == "hi"
    assert job["status"] == "applied"
    assert [h["status"] for h in job["history"]] == ["applied"]

    listed = client.get("/api/jobs").json()
    assert [j["id"] for j in listed] == [job["id"]]


@pytest.mark.parametrize("bad", ["javascript:alert(1)", "ftp://acme.com/x", "not a link", "http://localhost"])
def test_rejects_bad_urls(client, bad):
    res = client.post("/api/jobs", json={"company": "A", "role": "B", "url": bad})
    assert res.status_code == 422


def test_requires_company_and_role(client):
    assert client.post("/api/jobs", json={"company": "  ", "role": "B"}).status_code == 422
    assert client.post("/api/jobs", json={"company": "A"}).status_code == 422


def test_status_change_records_history_and_fills_date(client):
    job = make(client, status="saved")
    assert job["date_applied"] is None

    res = client.patch(f"/api/jobs/{job['id']}", json={"status": "interviewing"})
    updated = res.json()
    assert updated["status"] == "interviewing"
    assert updated["date_applied"] == date.today().isoformat()
    assert [h["status"] for h in updated["history"]] == ["saved", "interviewing"]

    # Same status again doesn't add a history entry.
    again = client.patch(f"/api/jobs/{job['id']}", json={"status": "interviewing", "notes": "x"}).json()
    assert len(again["history"]) == 2
    assert again["notes"] == "x"


def test_patch_can_clear_dates_but_not_required_fields(client):
    job = make(client, follow_up="2026-12-01")
    cleared = client.patch(f"/api/jobs/{job['id']}", json={"follow_up": None}).json()
    assert cleared["follow_up"] is None
    assert client.patch(f"/api/jobs/{job['id']}", json={"company": ""}).status_code == 422


def test_delete_and_404(client):
    job = make(client)
    assert client.delete(f"/api/jobs/{job['id']}").status_code == 204
    assert client.delete(f"/api/jobs/{job['id']}").status_code == 404
    assert client.patch("/api/jobs/nope", json={"notes": "x"}).status_code == 404


def test_import_old_browser_export_and_merge(client):
    old_export = {
        "app": "JobProgress", "version": 1,
        "jobs": [
            {
                "id": "abc", "company": "Globex", "role": "Dev", "url": "https://boards.greenhouse.io/x",
                "status": "rejected", "dateApplied": "2026-10-01", "followUp": "",
                "createdAt": "2026-10-01T10:00:00.000Z", "updatedAt": "2026-10-20T10:00:00.000Z",
                "history": [
                    {"status": "applied", "at": "2026-10-01T10:00:00.000Z"},
                    {"status": "rejected", "at": "2026-10-20T10:00:00.000Z"},
                ],
            },
            {"company": "", "role": ""},  # invalid, skipped
        ],
    }
    res = client.post("/api/import", json=old_export).json()
    assert res == {"added": 1, "updated": 0, "skipped": 1}

    job = client.get("/api/jobs/abc").json()
    assert job["date_applied"] == "2026-10-01"
    assert job["follow_up"] is None
    assert [h["status"] for h in job["history"]] == ["applied", "rejected"]

    # Re-importing our own export updates in place instead of duplicating.
    exported = client.get("/api/export").json()
    assert client.post("/api/import", json=exported).json() == {"added": 0, "updated": 1, "skipped": 0}
    assert len(client.get("/api/jobs").json()) == 1
