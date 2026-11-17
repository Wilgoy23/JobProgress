# Job Progress

A local tracker for job applications: a **React** frontend, a **Python (FastAPI)** backend, and a **SQLite** database on your machine.

## Features

- **Track each application:** company, role, job link, status, date applied, follow-up date, location, salary and notes.
- **One-click job site links:** paste the posting link (with or without `https://`) and the row gets a button such as **Workday ↗**, **Greenhouse ↗** or **Lever ↗** that opens it in a new tab. It recognizes Workday, Greenhouse, Lever, Ashby, iCIMS, SmartRecruiters, Taleo, SuccessFactors, Oracle, Jobvite, BambooHR, Workable, LinkedIn, Indeed, Glassdoor, Handshake, Wellfound and ZipRecruiter. Any other site shows its domain.
- **Statuses:** Saved → Applied → Assessment → Interviewing → Offer, plus Rejected / Withdrawn / Ghosted. Change status right from the list; every change is recorded in the job's status history.
- **Summary tiles:** total, in progress, interviewing, offers, closed and interview rate. Click a tile to filter.
- **Search, filter and sort** by update time, date applied, follow-up date, company or status.
- **Follow-up reminders:** follow-up dates that are today or overdue are highlighted.
- **Backup:** export to JSON (re-importable) or CSV (opens in Excel / Google Sheets). Importing merges by id, so re-importing the same backup won't create duplicates.
- Delete with undo, light and dark mode, mobile-friendly layout. Press **n** to add a job quickly.

## First-time setup

You need Python 3.10+ and Node.js 18+.

```powershell
# Backend
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt

# Frontend
cd ..\frontend
npm install
```

## Running it

### Everyday use (one process)

Build the frontend once (and again after you change frontend code), then start the backend. It serves the app and the API together:

```powershell
cd frontend
npm run build

cd ..\backend
.venv\Scripts\python -m uvicorn main:app
```

Open **http://localhost:8000**.

### Development (live reload)

Run these in two terminals:

```powershell
# Terminal 1: API on :8000, restarts on Python changes
cd backend
.venv\Scripts\python -m uvicorn main:app --reload

# Terminal 2: React dev server on :5173, hot reload; forwards /api to :8000
cd frontend
npm run dev
```

Open **http://localhost:5173**.

## Where your data lives

All data is in a single SQLite file: `backend/data/jobprogress.db` (created on first run, and ignored by git). To back it up, copy that file or use **Export JSON** in the app. Set the `JOBPROGRESS_DB` environment variable to keep the database somewhere else, e.g. a synced folder.

**Coming from the earlier browser-only version?** Use **Import** with a JSON file you exported from it; the old format is accepted.

## Project layout

```
backend/
  main.py           FastAPI app: REST routes, serves frontend/dist if it exists
  db.py             SQLite connection + schema (jobs, status_history)
  schemas.py        Pydantic models and validation (URL normalization, etc.)
  tests/            pytest suite
frontend/
  src/App.jsx       State, filtering/sorting, actions
  src/api.js        Fetch wrapper for the backend
  src/components/   Header, StatsBar, Toolbar, JobList, JobDialog, Toast
  src/lib/          Status/portal constants, date and URL helpers, CSV export
  src/styles.css    All styling (light/dark themes, mobile)
```

## API

| Method   | Path              | Description                                              |
| -------- | ----------------- | -------------------------------------------------------- |
| `GET`    | `/api/jobs`       | All jobs, each with its status history                   |
| `POST`   | `/api/jobs`       | Create a job                                             |
| `GET`    | `/api/jobs/{id}`  | One job                                                  |
| `PATCH`  | `/api/jobs/{id}`  | Update some fields; a status change is added to history  |
| `DELETE` | `/api/jobs/{id}`  | Delete a job (and its history)                           |
| `GET`    | `/api/export`     | Full JSON backup                                         |
| `POST`   | `/api/import`     | Merge a JSON backup (list or export object)              |

Interactive API docs: http://localhost:8000/docs

## Tests

```powershell
cd backend
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest
```
