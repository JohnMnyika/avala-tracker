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
