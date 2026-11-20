import sqlite3

import db


def test_default_location_is_per_user_app_data(tmp_path, monkeypatch):
    monkeypatch.delenv("JOBPROGRESS_DB", raising=False)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    assert db.db_path() == tmp_path / "JobProgress" / "jobprogress.db"


def test_legacy_database_is_copied_once(tmp_path, monkeypatch):
    legacy = tmp_path / "legacy" / "jobprogress.db"
    legacy.parent.mkdir()
    conn = sqlite3.connect(legacy)
    conn.executescript(db.SCHEMA)
    conn.execute(
        "INSERT INTO jobs (id, company, role, status, created_at, updated_at) VALUES ('x', 'Acme', 'Dev', 'applied', 't', 't')"
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(db, "LEGACY_DB_PATH", legacy)
    monkeypatch.delenv("JOBPROGRESS_DB", raising=False)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "appdata"))
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "appdata"))

    db.init_db()
    new = sqlite3.connect(db.db_path())
    assert new.execute("SELECT company FROM jobs").fetchall() == [("Acme",)]
    new.execute("DELETE FROM jobs")
    new.commit()
    new.close()

    # Already migrated: a second start must not copy the old data back in.
    db.init_db()
    again = sqlite3.connect(db.db_path())
    assert again.execute("SELECT COUNT(*) FROM jobs").fetchone() == (0,)
    again.close()
    assert legacy.exists()  # old file kept as a backup
