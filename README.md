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
  - KPI counts (Applied, OA, Interview, Offer, Rejected) with click-through filters
  - OA card: incomplete OAs only (`Status = OA` and `OA Complete = N`), with days since last update
  - Pipeline chart
  - Recent list sorted by **Last Updated** (click a row for details)
- **Applications table**
  - Search + clear status filter chips (Active, All, Applied, OA, …)
  - Row click → detail popup (edit status, advance round, mark rejected, set OA Complete when status is OA)
  - New application, bulk status edit + save, delete row
- **Sheet setup help** — if headers/tabs are wrong, the app shows which columns to add instead of failing silently
- **Dark mode** follows system preference

### Expected columns (row 1 of a year tab)

| Required | Optional |
| --- | --- |
| Company | Last Updated — stamped when status changes |
| Location | OA Complete — `N/A`, `N`, or `Y` (incomplete OAs show on the OA card) |
| Role | |
| Date Applied | |
| Status | |

**Status values:** `Applied`, `OA`, `Interview`, `Offer`, `Rejected`, `OA->Rejected`, `Interview->Rejected`

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
   - `GH_PAT` — classic PAT with `repo` (needed for empty-commit pings on app add / status advance)
3. Push to `main`

Site URL is typically `https://<owner>.github.io/<repo>/`.

Add the same Pages origin under your OAuth client’s authorized JavaScript origins.

> Vite embeds `VITE_*` values into the client bundle. That is normal for an OAuth **client ID**. `GH_PAT` is also baked in as `VITE_GH_PAT` only to fire `repository_dispatch` — it never sends sheet rows. Prefer a fine-scoped PAT you can rotate.

---

## Optional: empty GitHub commit when you add an application

Application rows stay in Google Sheets only. When you add an app or advance status, the site can fire `repository_dispatch` so `.github/workflows/application-ping.yml` creates an **empty** commit (`chore: application activity`) with **your** git author (so it counts on your contribution graph).

1. Create a classic PAT with `repo` scope; add it as Actions secret `GH_PAT`.
2. Confirm that PAT’s account email matches the author in `application-ping.yml` (and is verified on GitHub).
3. Redeploy so `VITE_GH_PAT` / `VITE_GITHUB_REPO` are in the Pages build.
4. Optional local test: set those in `.env.local` (see `.env.example`).

Without `GH_PAT`, adding an application only updates the Sheet.

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
- **`.github/workflows/application-ping.yml`** — empty commit on application activity (contribution graph).
- **`scripts/sync_sheet.py`** — optional offline export via a service account. Keep service-account JSON **outside** the repo; avoid using this on a public tracker.

---

## Project layout

```
.env.example
.github/workflows/deploy.yml
.github/workflows/application-ping.yml
google-apps-script/     # optional Sheet automations
scripts/                # optional offline sync
src/
  App.tsx
  components/
  lib/                  # auth, session, Sheets client, githubPing
  views/
```
