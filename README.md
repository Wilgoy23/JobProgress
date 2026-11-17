# Job Progress

A small, dependency-free tracker for job applications. Open `index.html` in any browser and you're running.

## Features

- **Track each application:** company, role, job link, status, date applied, follow-up date, location, salary and notes.
- **One-click job site links:** paste the posting link (with or without `https://`) and the row gets a button such as **Workday ↗**, **Greenhouse ↗** or **Lever ↗** that opens it in a new tab. It recognizes Workday, Greenhouse, Lever, Ashby, iCIMS, SmartRecruiters, Taleo, SuccessFactors, Oracle, Jobvite, BambooHR, Workable, LinkedIn, Indeed, Glassdoor, Handshake, Wellfound and ZipRecruiter. Any other site shows its domain.
- **Statuses:** Saved → Applied → Assessment → Interviewing → Offer, plus Rejected / Withdrawn / Ghosted. Change status right from the list; every change is logged in the job's status history.
- **Summary tiles:** total, in progress, interviewing, offers, closed and interview rate. Click a tile to filter.
- **Search, filter and sort** by update time, date applied, follow-up date, company or status.
- **Follow-up reminders:** follow-up dates that are today or overdue are highlighted.
- **Backup:** export to JSON (re-importable) or CSV (opens in Excel / Google Sheets). Importing merges by id, so re-importing the same backup won't create duplicates.
- Light and dark mode, mobile-friendly layout. Press **n** to add a job quickly.

## Where your data lives

Everything is stored in your browser's `localStorage` for this page. It's private to your machine and browser, but:

- clearing site data or using a private window will lose it, and
- a different browser or computer won't see it.

**Use _Export JSON_ now and then as a backup**, and _Import_ it to restore or move to another machine.

## Files

| File         | Purpose                              |
| ------------ | ------------------------------------ |
| `index.html` | Page layout and the add/edit dialog  |
| `styles.css` | Styling (light/dark themes, mobile)  |
| `app.js`     | All logic: storage, rendering, import/export |
