"""Job Progress API: FastAPI + SQLite.

Run (from the backend folder):  python -m uvicorn main:app --reload
"""

import sqlite3
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import Body, Depends, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from db import get_conn, init_db
from schemas import ImportJob, ImportResult, JobCreate, JobOut, JobUpdate, to_utc_iso

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

JOB_COLUMNS = (
    "company", "role", "url", "status", "date_applied", "follow_up",
    "location", "salary", "notes",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Job Progress", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return to_utc_iso(datetime.now(timezone.utc))


def to_db(value: Any) -> Any:
    return value.isoformat() if isinstance(value, date) else value


def fetch_jobs(conn: sqlite3.Connection, job_id: Optional[str] = None) -> list[dict]:
    where, params = ("WHERE id = ?", (job_id,)) if job_id else ("", ())
    rows = conn.execute(f"SELECT * FROM jobs {where} ORDER BY updated_at DESC", params).fetchall()

    hist_where = "WHERE job_id = ?" if job_id else ""
    history: dict[str, list[dict]] = defaultdict(list)
    for h in conn.execute(
        f"SELECT job_id, status, at FROM status_history {hist_where} ORDER BY at, id", params
    ):
        history[h["job_id"]].append({"status": h["status"], "at": h["at"]})

    return [{**dict(r), "history": history[r["id"]]} for r in rows]


def get_job_or_404(conn: sqlite3.Connection, job_id: str) -> dict:
    found = fetch_jobs(conn, job_id)
    if not found:
        raise HTTPException(status_code=404, detail="Job not found")
    return found[0]


def add_history(conn: sqlite3.Connection, job_id: str, status: str, at: str) -> None:
    conn.execute("INSERT INTO status_history (job_id, status, at) VALUES (?, ?, ?)", (job_id, status, at))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/jobs", response_model=list[JobOut])
def list_jobs(conn: sqlite3.Connection = Depends(get_conn)):
    return fetch_jobs(conn)


@app.get("/api/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, conn: sqlite3.Connection = Depends(get_conn)):
    return get_job_or_404(conn, job_id)


@app.post("/api/jobs", response_model=JobOut, status_code=201)
def create_job(body: JobCreate, conn: sqlite3.Connection = Depends(get_conn)):
    job_id = str(uuid.uuid4())
    now = now_iso()
    data = body.model_dump()
    with conn:
        conn.execute(
            f"INSERT INTO jobs (id, {', '.join(JOB_COLUMNS)}, created_at, updated_at) "
            f"VALUES (?, {', '.join('?' * len(JOB_COLUMNS))}, ?, ?)",
            (job_id, *(to_db(data[c]) for c in JOB_COLUMNS), now, now),
        )
        add_history(conn, job_id, data["status"], now)
    return get_job_or_404(conn, job_id)


@app.patch("/api/jobs/{job_id}", response_model=JobOut)
def update_job(job_id: str, body: JobUpdate, conn: sqlite3.Connection = Depends(get_conn)):
    current = get_job_or_404(conn, job_id)

    # Only fields the client actually sent. Dates may be cleared with null; nothing else may.
    changes = {
        k: v for k, v in body.model_dump(exclude_unset=True).items()
        if v is not None or k in ("date_applied", "follow_up")
    }

    new_status = changes.get("status")
    status_changed = new_status is not None and new_status != current["status"]
    # Moving past "saved" with no applied date means you applied today.
    if status_changed and new_status != "saved" and not changes.get("date_applied", current["date_applied"]):
        changes["date_applied"] = date.today()

    now = now_iso()
    changes["updated_at"] = now
    assignments = ", ".join(f"{col} = ?" for col in changes)  # column names come from the model, not user input
    with conn:
        conn.execute(f"UPDATE jobs SET {assignments} WHERE id = ?", (*map(to_db, changes.values()), job_id))
        if status_changed:
            add_history(conn, job_id, new_status, now)
    return get_job_or_404(conn, job_id)


@app.delete("/api/jobs/{job_id}", status_code=204)
def delete_job(job_id: str, conn: sqlite3.Connection = Depends(get_conn)):
    with conn:
        cur = conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return Response(status_code=204)


@app.get("/api/export")
def export_jobs(conn: sqlite3.Connection = Depends(get_conn)):
    jobs = [JobOut.model_validate(j).model_dump(mode="json") for j in fetch_jobs(conn)]
    return {"app": "JobProgress", "version": 2, "exported_at": now_iso(), "jobs": jobs}


@app.post("/api/import", response_model=ImportResult)
def import_jobs(payload: Any = Body(...), conn: sqlite3.Connection = Depends(get_conn)):
    """Merge jobs from a JSON backup (a list, or an export object with a "jobs" list).

    Jobs whose id already exists are replaced; invalid entries are skipped.
    """
    items = payload.get("jobs") if isinstance(payload, dict) else payload
    if not isinstance(items, list):
        raise HTTPException(status_code=422, detail="Expected a list of jobs or an export file with a 'jobs' list")

    added = updated = skipped = 0
    with conn:
        for item in items:
            try:
                job = ImportJob.model_validate(item)
            except ValidationError:
                skipped += 1
                continue

            job_id = job.id or str(uuid.uuid4())
            created = to_utc_iso(job.created_at) if job.created_at else now_iso()
            updated_at = to_utc_iso(job.updated_at) if job.updated_at else created
            history = [(h.status, to_utc_iso(h.at)) for h in job.history] or [(job.status, created)]
            values = [to_db(getattr(job, c)) for c in JOB_COLUMNS]

            exists = conn.execute("SELECT 1 FROM jobs WHERE id = ?", (job_id,)).fetchone()
            if exists:
                updated += 1
                assignments = ", ".join(f"{c} = ?" for c in JOB_COLUMNS)
                conn.execute(
                    f"UPDATE jobs SET {assignments}, created_at = ?, updated_at = ? WHERE id = ?",
                    (*values, created, updated_at, job_id),
                )
                conn.execute("DELETE FROM status_history WHERE job_id = ?", (job_id,))
            else:
                added += 1
                conn.execute(
                    f"INSERT INTO jobs (id, {', '.join(JOB_COLUMNS)}, created_at, updated_at) "
                    f"VALUES (?, {', '.join('?' * len(JOB_COLUMNS))}, ?, ?)",
                    (job_id, *values, created, updated_at),
                )
            for status, at in history:
                add_history(conn, job_id, status, at)

    return ImportResult(added=added, updated=updated, skipped=skipped)


# Serve the built React app (frontend/dist) when it exists, so one process runs everything.
# Mounted last so /api routes take priority.
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
