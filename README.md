# Application Tracker

Static internship application dashboard. Data lives in a Google Sheet; a GitHub Action syncs rows into `src/data/data.json`, and the Vite + React site is deployed to GitHub Pages.

## Stack

- Vite + React + TypeScript + Tailwind CSS
- Recharts (status funnel)
- Google Sheets API (service account)
- GitHub Actions → GitHub Pages

## Local development

```bash
npm install
npm run dev
```

Uses the checked-in sample data in `src/data/data.json`. Build with:

```bash
npm run build
npm run preview
```

For local preview of a GitHub Pages project site, the Vite `base` path defaults to `/internship-apps-dashboard/`. Override with `VITE_BASE_PATH=/` if needed.

## Google Cloud setup (Sheets API)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create (or select) a project.
2. Enable **Google Sheets API** for the project.
3. Create a **service account** (IAM & Admin → Service Accounts → Create).
4. Open the service account → **Keys** → **Add key** → **Create new key** → JSON.
5. Download the JSON key file — this is the value for `GOOGLE_SERVICE_ACCOUNT_KEY`.
6. Open your Google Sheet and share it with the service account email (`…@….iam.gserviceaccount.com`) as **Viewer**.
7. Copy the spreadsheet ID from the Sheet URL:
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`

### Expected sheet columns

Row 1 headers (exact names):

| Company | Location | Role | Date Applied | Status |

**Status** values: `Applied`, `OA`, `Interview`, `Offer`, `Rejected`

## GitHub repository secrets

In the repo: **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full contents of the service account JSON key file |
| `SHEET_ID` | Spreadsheet ID from the Sheet URL |

The sync workflow (`.github/workflows/sync.yml`) needs write access to `main` (default `GITHUB_TOKEN` with `contents: write` is enough for a same-repo push).

## Sync workflow

`.github/workflows/sync.yml` runs on:

- `repository_dispatch` with type `sheet-updated` (fired by the Apps Script)
- Manual **workflow_dispatch** (Actions → Sync Sheet Data → Run workflow)

It:

1. Authenticates to Google Sheets with the service account
2. Reads all rows
3. Computes totals and rates (count ÷ total applications, as %)
4. Writes `src/data/data.json`
5. Commits and pushes only if the file changed (`sync: update application data`)

You can run the sync locally as well:

```bash
export GOOGLE_SERVICE_ACCOUNT_KEY="$(cat path/to/key.json)"
export SHEET_ID="your-sheet-id"
pip install -r requirements.txt
python scripts/sync_sheet.py
```

## Apps Script trigger (`google-apps-script/onEdit.gs`)

1. Open the Sheet → **Extensions → Apps Script**.
2. Paste the contents of `google-apps-script/onEdit.gs`.
3. Replace the placeholders at the top:
   ```javascript
   var OWNER = "your-github-username";
   var REPO = "internship-apps-dashboard";
   ```
4. **Project Settings → Script Properties** → add:
   | Property | Value |
   | --- | --- |
   | `GITHUB_TOKEN` | GitHub PAT with permission to create `repository_dispatch` events on this repo (classic: `repo` scope; or fine-grained: Contents: Read + Metadata, and permission to dispatch workflow events / administer if required) |
5. Save the script.
6. Run `createInstallableOnEditTrigger` once from the editor (authorize when prompted). This creates an installable trigger for `handleSheetEdit` — required because `UrlFetchApp` cannot run from a simple `onEdit`.
7. When you complete a new row (all five columns filled, Status valid), the script POSTs to:
   `https://api.github.com/repos/{OWNER}/{REPO}/dispatches`
   with `event_type: "sheet-updated"`.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys on every push to `main` (including data-sync commits).

Enable Pages:

1. **Settings → Pages → Build and deployment → Source:** GitHub Actions
2. Push to `main` (or run the Deploy workflow manually)

The site URL will be:

`https://<owner>.github.io/<repo>/`

## Project layout

```
.github/workflows/
  sync.yml          # Sheet → data.json
  deploy.yml        # Build + GitHub Pages
google-apps-script/
  onEdit.gs         # Sheet edit → repository_dispatch
scripts/
  sync_sheet.py     # Google Sheets → src/data/data.json
src/
  data/data.json    # Generated + sample source of truth for the UI
  components/       # Lightning-style UI pieces
  views/            # Dashboard + Applications
```
