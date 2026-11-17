"""Request/response models and validation."""

import re
from datetime import date, datetime, timezone
from typing import Literal, Optional
from urllib.parse import urlsplit

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

Status = Literal[
    "saved", "applied", "assessment", "interviewing",
    "offer", "rejected", "withdrawn", "ghosted",
]

TEXT_FIELDS = ("company", "role", "url", "location", "salary", "notes")
DATE_FIELDS = ("date_applied", "follow_up")


def normalize_url(raw: Optional[str]) -> str:
    """Accept links pasted without a scheme; reject anything that isn't http(s)."""
    s = (raw or "").strip()
    if not s:
        return ""
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", s):
        s = "https://" + s
    try:
        parts = urlsplit(s)
        host = parts.hostname or ""
        parts.port  # raises ValueError on a malformed port
    except ValueError:
        raise ValueError("must be a valid web link")
    if parts.scheme.lower() not in ("http", "https") or "." not in host:
        raise ValueError("must be a valid http(s) web link")
    return s


def to_utc_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def _strip(v):
    if v is None:
        return ""
    return v.strip() if isinstance(v, str) else v


def _blank_to_none(v):
    return None if v == "" else v


class JobCreate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    url: str = Field(default="", max_length=2000)
    status: Status = "applied"
    date_applied: Optional[date] = None
    follow_up: Optional[date] = None
    location: str = Field(default="", max_length=200)
    salary: str = Field(default="", max_length=100)
    notes: str = Field(default="", max_length=5000)

    strip_text = field_validator(*TEXT_FIELDS, mode="before")(_strip)
    blank_dates = field_validator(*DATE_FIELDS, mode="before")(_blank_to_none)

    @field_validator("url")
    @classmethod
    def _check_url(cls, v: str) -> str:
        return normalize_url(v)


class JobUpdate(BaseModel):
    """Partial update: only the fields sent are changed."""

    company: Optional[str] = Field(default=None, min_length=1, max_length=200)
    role: Optional[str] = Field(default=None, min_length=1, max_length=200)
    url: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[Status] = None
    date_applied: Optional[date] = None
    follow_up: Optional[date] = None
    location: Optional[str] = Field(default=None, max_length=200)
    salary: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=5000)

    strip_text = field_validator(*TEXT_FIELDS, mode="before")(_strip)
    blank_dates = field_validator(*DATE_FIELDS, mode="before")(_blank_to_none)

    @field_validator("url")
    @classmethod
    def _check_url(cls, v: Optional[str]) -> str:
        return normalize_url(v)


class HistoryEntry(BaseModel):
    status: Status
    at: datetime


class ImportJob(JobCreate):
    """A job from a JSON backup. Also accepts the old browser-only version's camelCase fields."""

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(default=None, min_length=1, max_length=100)
    date_applied: Optional[date] = Field(default=None, validation_alias=AliasChoices("date_applied", "dateApplied"))
    follow_up: Optional[date] = Field(default=None, validation_alias=AliasChoices("follow_up", "followUp"))
    created_at: Optional[datetime] = Field(default=None, validation_alias=AliasChoices("created_at", "createdAt"))
    updated_at: Optional[datetime] = Field(default=None, validation_alias=AliasChoices("updated_at", "updatedAt"))
    history: list[HistoryEntry] = Field(default_factory=list)


class HistoryOut(BaseModel):
    status: Status
    at: str


class JobOut(BaseModel):
    id: str
    company: str
    role: str
    url: str
    status: Status
    date_applied: Optional[date]
    follow_up: Optional[date]
    location: str
    salary: str
    notes: str
    created_at: str
    updated_at: str
    history: list[HistoryOut]


class ImportResult(BaseModel):
    added: int
    updated: int
    skipped: int
