# Application Tracker

Static internship dashboard (Vite + React). The repo stays public-safe: **no application rows or credentials are committed**. Visitors sign in with Google; the app then reads your private Sheet with their OAuth token.

## How access control works

1. **Google Sign-In** — OAuth in the browser (Google Identity Services).
3. **Hardcoded allowlist** — only `astridig@umich.edu` may sign in (see `src/lib/config.ts`).
4. **Sheet ACL (real gate)** — Keep the spreadsheet private and shared only with that Google account. Other signed-in users get a Sheets API 403 even if they bypass the UI check.
5. **No baked-in data** — The GitHub Pages build ships an empty shell. Rows are fetched after login and live only in memory.

Do **not** share the Sheet publicly or with “anyone with the link”.

## Stack

- Vite + React + TypeScript + Tailwind CSS
- Recharts
- Google Identity Services + Google Sheets API (browser OAuth)
- GitHub Pages

## Local development

```bash
cp .env.example .env.local
# fill in VITE_GOOGLE_CLIENT_ID and VITE_SHEET_ID
npm install
npm run dev
```

Only `astridig@umich.edu` can sign in. `.env.local` is gitignored — never commit it.

## Google Cloud OAuth setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. Enable **Google Sheets API**.
3. **APIs & Services → OAuth consent screen** — configure as External (or Internal if Workspace). Add scopes:
   - `.../auth/spreadsheets.readonly`
   - `email`, `profile`, `openid`
4. **Credentials → Create credentials → OAuth client ID → Web application**.
5. Authorized JavaScript origins (examples):
   - `http://localhost:5173`
   - `https://<your-username>.github.io`
6. Copy the **Client ID** (safe to expose in the frontend).
7. Create your Google Sheet with headers:

   | Company | Location | Role | Date Applied | Status |

   Status values: `Applied`, `OA`, `Interview`, `Offer`, `Rejected`

8. Keep the Sheet **private**. Share it only with the Google account you will use to sign in.
9. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`

### Publishing / testing mode

While the OAuth app is in **Testing**, add your Google account as a test user on the consent screen.

## GitHub secrets (for Pages build)

**Settings → Secrets and variables → Actions**:

| Secret | Purpose |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | OAuth Web client ID (public by design; still inject via secret to avoid hardcoding) |
| `VITE_SHEET_ID` | Spreadsheet ID |

Sign-in is restricted in code to `astridig@umich.edu` — no email secret needed.

There is **no** service-account key and **no** GitHub PAT required for the site itself.

> Note: Vite embeds `VITE_*` values into the client bundle. That is expected for the OAuth client ID. The Sheet ID is not a password — protection comes from keeping the Sheet private. Do not put service-account private keys or PATs in any `VITE_*` variable.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys the empty authenticated shell on push to `main`.

1. **Settings → Pages → Source:** GitHub Actions
2. Add the two secrets above
3. Push to `main`

URL: `https://<owner>.github.io/<repo>/`

## Optional: local CLI export

`scripts/sync_sheet.py` can still pull a sheet with a **service account** for offline use. Prefer not to use it if the repo is public — it tempts committing `data.json`. If you do run it locally, restore the empty stub before committing:

```bash
cp src/data/data.example.json src/data/data.json
```

Service account JSON must stay **outside** the repo.

## Optional: Apps Script dispatch

`google-apps-script/onEdit.gs` is **not required** with live OAuth fetch (Refresh in the UI reloads the sheet). Keep it only if you want a custom automation; do not store PATs in git.

## Project layout

```
.env.example                 # Template for local env (no secrets)
.github/workflows/deploy.yml # Build + Pages (no sheet data in git)
src/
  lib/googleAuth.ts          # Google sign-in
  lib/sheet.ts               # Sheets fetch + stats
  components/LoginScreen.tsx
  data/data.json             # Empty public stub
```

## What must never be committed

- Service account JSON / private keys
- GitHub PATs
- `.env` / `.env.local`
- Real application rows in `src/data/data.json`
