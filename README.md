# Avala Work Tracker

Chrome extension for tracking Avala annotation work automatically and presenting it through a professional productivity dashboard.

## What It Tracks

- Project type: 2D Annotation or Burro Segmentation
- Dataset name, sequence ID, slice, item ID, and work unit UID
- Start time, end time, and time spent
- Automatic session tracking when Avala tabs are opened and revisited
- Daily/weekly/monthly productivity summaries and dataset/project analytics

## Dashboard Highlights

Open the extension popup and click Open Dashboard. The dashboard now includes:

- Today, weekly, and monthly task totals
- Today, weekly, and monthly hours
- Average time per task, tasks per hour, and earnings estimates
- Most worked dataset and project cards
- Current active task, longest/shortest sessions, and total sessions
- Smart timeline events, project and dataset analytics, and export support

## Load It In Chrome

1. Open chrome://extensions.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this project folder: /home/spike/Desktop/Projects/avala-tracker.
5. Open Avala task pages normally. The extension will detect them automatically.

## Testing

Run the parser regression tests:

```bash
node --test tests/parser.test.js
```

## Developer Utilities

- Import exported project data:

```bash
node scripts/import-projects.js path/to/avala-projects.json
```

- Watch for auto-imported project exports:

```bash
node scripts/watch-and-import.js avala-projects.json
```

The extension also seeds a default Burro Segmentation project on install so it appears immediately in the dashboard.

## Spreadsheet workflow

The spreadsheet is the primary assignment source. For automatic import, paste the Google Sheets link into the dashboard once (the supplied Sunny-Kookaburra link is prefilled for new installs). The extension requests that tab’s stable CSV export through your signed-in Chrome Google session, then syncs it every five minutes. It does not scrape the Google Sheets page. If your Chrome account cannot read the sheet, the dashboard shows the import error and leaves existing local history intact.

Quick import is also available when you want to refresh instantly: copy the header plus assignment rows in Google Sheets, paste them into **Quick import** on the dashboard, and select **Import pasted assignments**. For organisations that block extension access to Sheets exports, use the optional Apps Script Web App URL and choose **Sync assignments**. The endpoint must return JSON in the form `{ "assignments": [ { "Assignment ID": "…", "Camera": "…", "Frame": "…", "Annotator": "…", "Status": "…" } ] }` (a bare array also works).

`apps-script/Code.gs` is a credential-free template. Create a standalone Apps Script project, set `SPREADSHEET_ID` and `SHEET_NAME` in Script Properties, deploy it as a Web App, and put its `/exec` URL in the dashboard. For the supplied Sunny-Kookaburra sheet, use the exact values in `apps-script/SETUP.md`. Do not put Google credentials in this extension.

Spreadsheet rows are identified by a normalized `assignment_id + camera + frame + annotator` key, so reordering rows does not create duplicate work. A personal session starts when your row first becomes **In Progress** and is completed exactly once when it becomes **Complete**. The local append-only work log retains completed history if a later sync fails. Avala URL tracking remains available as legacy history and activity detection.

Run both regression suites where Node is installed:

```bash
node --test tests/parser.test.js tests/workflow.test.js
```
