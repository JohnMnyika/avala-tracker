# Avala Work Tracker

Chrome extension for tracking Avala job links locally.

## What It Tracks

- Dataset number, for example `v1-batch-000g5-sf-bev`
- Camera, for example `FNC`
- Sequence id
- Work unit id
- Date and time the link was detected
- Start time, end time, and duration
- Visit count for the same work unit

## Dashboard

Open the extension popup and click **Open Dashboard**. The dashboard includes:

- Today, weekly, and monthly task totals
- Today, weekly, and monthly time totals
- Average time per task and tasks per hour
- Recent activity, dataset statistics, and camera statistics tables
- Daily, weekly, monthly, dataset-time, and camera-time charts
- Dark mode, search, dataset/camera filters, CSV export, rankings, reports, productivity goal notifications, and estimated earnings by rate per task

## Load It In Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder: `/home/spike/Desktop/Projects/avala-tracker`.
5. Open Avala job links normally. The extension will track matching `https://avala.ai/.../datasets/.../sequences/...` links.

Use the extension popup to open the dashboard or manually track the current tab.
