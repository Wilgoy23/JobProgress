"""SQLite connection handling and schema."""

import os
import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "data" / "jobprogress.db"

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


def db_path() -> Path:
    """Database file location; override with the JOBPROGRESS_DB env var."""
    return Path(os.environ.get("JOBPROGRESS_DB", DEFAULT_DB_PATH))


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
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
