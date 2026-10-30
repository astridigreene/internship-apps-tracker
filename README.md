# Internship Applications Tracker

A personal dashboard for tracking internship applications. Sign in with Google, connect a spreadsheet, and manage status updates from the UI.

Your application rows stay in **your** Google Sheet. The site does not store your data on a server.

**Sheet template (copy this):**  
[Internship Applications Tracker template](https://docs.google.com/spreadsheets/d/1EW4mMS6pUuRg4xcvVLdUF5jciZsnIaJG8VYYdJJAUNQ/edit?usp=sharing)

> In Google Sheets: **File → Make a copy**. Keep your copy private (or shared only with accounts you trust).

---

## Features

- **Google sign-in** — OAuth in the browser; reconnects on return visits when possible
- **Your own spreadsheet** — paste a Sheet URL once; the ID is remembered in this browser for your Google account
- **Year tabs** — tabs named like `2027`, `2026`
- **Dashboard**
  - KPI counts (Applied, Progressed, Interview, Offer, Rejected) with click-through filters — Progressed/Interview/Offer are cumulative (furthest stage ever reached), so a rejection after an OA still counts as Progressed
  - **In Progress** count banner — applications currently Progressed or in Interview, links to the In Progress tab
  - Pending OA/HireVue card — entries with `Complete = No`, sorted by soonest `Deadline`
  - Pipeline chart
  - Recent list sorted by **Last Updated** (click a row for details)
- **Applications table**
  - Search + clear status filter chips (Active, All, Applied, Progressed, …)
  - Row click → detail popup (edit status, advance round, mark rejected, log/complete linked OA·HireVue·Screening·Interview entries)
  - New application, bulk status edit + save, delete row
- **In Progress tab** — every application currently Progressed or Interview, with its linked OA/HireVue deadlines, screenings, and interview date/times inline
- **Calendar tab** — month grid + upcoming list of interviews, screenings, OA/HireVue deadlines, and the times you've scheduled yourself to do an OA/HireVue (click an item to open its application)
- **Schedule an OA/HireVue** — set a "Do it at" time on an entry and the app creates a Google Calendar event and sends an invite (to `VITE_CALENDAR_INVITE_EMAIL`, or your signed-in account); editing or deleting the entry updates or cancels the event. Needs the **Google Calendar API** enabled in the OAuth client's Cloud project
- **Sheet setup help** — if headers/tabs are wrong, the app shows which columns to add instead of failing silently
- **Dark mode** follows system preference
- **NeetCode tab** — progress, next two study days, and the full 150-problem checklist from a separate NeetCode Tracker sheet; tick problems done right from the page (see [NeetCode tab](#neetcode-tab))

### Expected columns (row 1 of a year tab)

| Required | Optional |
| --- | --- |
| Company | Last Updated — stamped when status changes |
| Location | Highest Stage — auto-stamped, furthest stage reached (survives a later rejection) |
| Role | |
| Date Applied | |
| Status | |

**Status values:** `Applied`, `Progressed`, `Interview`, `Offer`, `Rejected`

### Sibling tabs per year (optional, auto-created)

Alongside a year tab (e.g. `2027`), the app can read/write four optional sibling
tabs for the detail behind a `Progressed`/`Interview` status. They're created
automatically the first time you log an entry from the app — you don't have to
make them by hand:

| Tab | Columns |
| --- | --- |
| `2027 OA` | Deadline (date & time), Auto, Company, Date Offered, Length (minutes), Site, Complete, App Row, Scheduled For, Calendar Event |
| `2027 HireVue` | same as OA |
| `2027 Interviews` | Company, Date & Time, End Time, Notes, Complete, App Row |
| `2027 Screening` | Company, Date & Time, End Time, Notes, App Row |

A company can have several OA/HireVue/Interview rows at once. **App Row** is the
row number of the application on the year tab, so an entry stays tied to one role
when you've applied to several at the same company. The dashboard fills it in for
entries added from an application, adds the column to older tabs automatically,
and keeps it correct when an application row is deleted (sorting or inserting rows
on the year tab by hand will break it). Entries with a blank App Row fall back to
matching Company name (case-insensitive) within the same year.

The template already includes these headers (and sample year tabs). Use **Make a copy** rather than editing the template itself if you do not own it.

---

## Using a deployed site (end users)

1. Open the tracker URL.
2. **Sign in with Google** (the same account that can edit your spreadsheet).
3. If prompted, paste your spreadsheet URL or ID (from your **copy** of the template).
4. Use the dashboard and Applications tab as usual.

Only people who can open your Sheet in Google can load its data in the tracker. Do **not** share sensitive job-search Sheets as “anyone with the link.”

While the Google Cloud OAuth app is in **Testing**, each Google account must be added as a test user on the consent screen (or the app must be published).

---

## Set up for development or your own deploy

### 1. Spreadsheet

1. Open the [template](https://docs.google.com/spreadsheets/d/1EW4mMS6pUuRg4xcvVLdUF5jciZsnIaJG8VYYdJJAUNQ/edit?usp=sharing).
2. **File → Make a copy**.
3. Rename year tabs if needed (`2027`, etc.).
4. Keep the sheet private / share only with the Google accounts that should use it.

### 2. Google Cloud OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. Enable **Google Sheets API**.
3. **APIs & Services → OAuth consent screen** — External (or Internal for Workspace). Scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `email`, `profile`, `openid`
4. **Credentials → Create credentials → OAuth client ID → Web application**.
5. Authorized JavaScript origins (examples):
   - `http://localhost:5173`
   - `https://<your-username>.github.io`
6. Copy the **Client ID** (this is a public client ID for a browser app — still do not commit private keys or service-account JSON).

### 3. Local development

```bash
cp .env.example .env.local
# Set VITE_GOOGLE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
npm install
npm run dev
```

`.env.local` is gitignored — **never commit it**.

Optional for local convenience only: `VITE_SHEET_ID` in `.env.local` to pre-select a spreadsheet. Deployed users can always paste their own Sheet after sign-in.

### 4. Deploy (GitHub Pages)

This repo includes `.github/workflows/deploy.yml` (builds on push to `main`).

1. **Settings → Pages → Source:** GitHub Actions  
2. **Settings → Secrets and variables → Actions** — add:
   - `VITE_GOOGLE_CLIENT_ID` — your OAuth Web client ID  
3. Push to `main`

Site URL is typically `https://<owner>.github.io/<repo>/`.

Add the same Pages origin under your OAuth client’s authorized JavaScript origins.

> Vite embeds `VITE_*` values into the client bundle. That is normal for an OAuth **client ID**. Never put service-account private keys, refresh tokens, or PATs in any `VITE_*` variable or in git.

---

## NeetCode tab

The **NeetCode** tab reads a second Google Sheet, the *NeetCode Tracker*, the same way the
rest of the dashboard reads your applications: directly from the browser with your Google
sign-in. There's no Apps Script export, no GitHub Action, and no JSON committed to the repo.

**All scheduling stays in the sheet.** Planned dates, statuses, projected finish and the
extra-minutes figures are whatever the sheet's formulas compute; the page only displays them.

### Sheet layout

| Tab | What the page reads |
| --- | --- |
| `Checklist` | Row 1 headers: `#`, `Problem`, `Category`, `Diff` (E/M/H), `Min`, `Done` (checkbox or `x`), `Original deadline`, `Planned date`, `Status`. Matched by header name, so extra columns (like the helper column) are fine. |
| `Next Up` | Labels in column A, values in column B: `Next study day`, `Following study day`, and the Progress block (`Done`, `Remaining`, `Remaining minutes`, `Original finish deadline`, `Projected finish`, `Problems behind schedule`, `Extra minutes needed…`, `…extra min per study day`). Problem lists sit under `Do on next study day` / `Do on following study day`. |
| `Capacity` | Not read directly; it feeds the formulas above. |

### Sheet ID

The sheet ID is the long part of the URL: `docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.

- **Deployed site:** add a repo **variable** (Settings → Secrets and variables → Actions →
  Variables) named `NEETCODE_SHEET_ID`. `deploy.yml` passes it to the build as
  `VITE_NEETCODE_SHEET_ID`.
- **Local dev:** set `VITE_NEETCODE_SHEET_ID=<SHEET_ID>` in `.env.local`.
- **Without either:** the NeetCode tab asks you to paste the sheet URL, and remembers it in
  this browser for your Google account. *Use a different sheet* (shown on the error screen)
  clears it.

The ID isn't a secret: only Google accounts that can open the sheet can load or change it.

### Ticking problems (write-back)

Ticking a checkbox (in *Next up* or the table) writes `TRUE` to that row's `Done` cell
(column F in the template) through the Sheets API, using your sign-in's existing
`spreadsheets` scope. Unticking writes `FALSE` to a checkbox cell, or clears a cell that
held a typed `x`. After the write, the page re-reads both tabs so the recalculated planned
dates show up. If a write fails, the row snaps back and an error appears with an
*Open in Sheets* link.

**No token is needed.** A shared secret would have to be shipped in the public JS bundle,
so this tab relies on Google OAuth instead: you can only write to the sheet if your Google
account has edit access to it.

### Empty and error states

- Sheet unreachable or not shared with you → error panel with *Retry* / *Use a different sheet*.
- Missing tab or `Checklist` columns → the page lists what to fix.
- Problems with no planned date (ran out of `Capacity` rows) → banner: add days to `Capacity`.
- No upcoming study day → the *Next up* card says to add days to `Capacity`.

Parser checks: `npm run test:neetcode`.

---

## Optional: daily reminder email (8:30pm)

Example file: `google-apps-script/dailyReminder.example.gs`  
(Your personal copy `dailyReminder.gs` is gitignored.)

Emails a nudge to apply plus incomplete OAs (`Status = OA` and `OA Complete = N`).

1. Spreadsheet → **Extensions → Apps Script** → paste the example (set your email / dashboard URL).
2. **Project settings → Time zone** → Eastern (or your zone) — 8:30pm uses this.
3. Run **`createDailyReminderTrigger`** once (authorize Gmail/Sheets when asked).
4. Optional test: run **`sendDailyReminderEmail`**.

Optional Script properties: `REMINDER_EMAIL`, `REMINDER_YEAR` (e.g. `2027`).

---

## Privacy & security checklist

- No application rows or personal emails are committed to this repo (`data.json` is an empty stub if present).
- Spreadsheet ID after connect is stored in **browser localStorage** (per Google email on that device), not on a backend.
- OAuth tokens live in the browser session storage used by the app; sign out clears the session.
- Do not commit `.env.local`, credentials JSON, or Apps Script secrets.
- Prefer a private Sheet + Google sharing ACL as the real access control.

---

## Stack

- Vite + React + TypeScript + Tailwind CSS  
- Recharts  
- Google Identity Services + Google Sheets API (browser OAuth)  
- GitHub Pages  

---

## Optional extras

- **`google-apps-script/`** — optional Sheet helpers (daily reminder email, Last Updated stamp). Do not put tokens in git.
- **`scripts/sync_sheet.py`** — optional offline export via a service account. Keep service-account JSON **outside** the repo; avoid using this on a public tracker.

---

## Project layout

```
.env.example
.github/workflows/deploy.yml
google-apps-script/     # optional Sheet automations
scripts/                # optional offline sync
src/
  App.tsx
  components/
  lib/                  # auth, session, Sheets client
  views/
```
