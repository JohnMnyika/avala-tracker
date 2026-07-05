# Developer Notes

This project is a Manifest V3 Chrome extension with no build step.

- `background.js` listens for Avala tab loads and Avala single-page navigation changes.
- `background.js` stores the active task id and closes the previous task when a different Avala job opens.
- `avalaParser.js` parses dataset, sequence, camera, work unit id, and timestamps from the Avala URL.
- `dashboard.html` shows records from `chrome.storage.local` with productivity metrics, tables, charts, rankings, reports, dark mode, estimated earnings, and daily goal notifications.
- `popup.html` exposes quick actions for tracking the current tab and opening the dashboard.

Records are stored locally in Chrome under the `avalaWorkRecords` storage key.
The active task id is stored under `avalaActiveTaskId`.
Dashboard settings are stored under `avalaDashboardSettings`.
