"""SQLite connection handling and schema."""

import os
import sqlite3
from pathlib import Path

# Where the database lived before it moved to the per-user app data folder.
LEGACY_DB_PATH = Path(__file__).resolve().parent / "data" / "jobprogress.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id            TEXT PRIMARY KEY,
    company       TEXT NOT NULL,
    role          TEXT NOT NULL,
    url           TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL,
    date_applied  TEXT,            -- YYYY-MM-DD
    follow_up     TEXT,            -- YYYY-MM-DD
    location      TEXT NOT NULL DEFAULT '',
    salary        TEXT NOT NULL DEFAULT '',
    notes         TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL,   -- ISO 8601, UTC
    updated_at    TEXT NOT NULL    -- ISO 8601, UTC
);

CREATE TABLE IF NOT EXISTS status_history (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id  TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status  TEXT NOT NULL,
    at      TEXT NOT NULL          -- ISO 8601, UTC
);

CREATE INDEX IF NOT EXISTS idx_status_history_job ON status_history(job_id, at);
"""


def app_data_dir() -> Path:
    """Per-user folder for app data, e.g. %LOCALAPPDATA%\\JobProgress on Windows."""
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local"
    else:
        base = os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share"
    return Path(base) / "JobProgress"


def db_path() -> Path:
    """Database file location; override with the JOBPROGRESS_DB env var."""
    override = os.environ.get("JOBPROGRESS_DB")
    return Path(override) if override else app_data_dir() / "jobprogress.db"


def _migrate_legacy_db(target: Path) -> None:
    """Copy backend/data/jobprogress.db to the new location once. The old file is left as a backup."""
    if os.environ.get("JOBPROGRESS_DB") or target.exists() or not LEGACY_DB_PATH.is_file():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    src = sqlite3.connect(LEGACY_DB_PATH)
    dst = sqlite3.connect(target)
    try:
        src.backup(dst)  # safe even if the old file is open elsewhere
    finally:
        src.close()
        dst.close()


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    _migrate_legacy_db(db_path())
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def get_conn():
    """FastAPI dependency: one connection per request.

    Endpoints commit explicitly with `with conn:` so writes are durable
    before the response is returned.
    """
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
