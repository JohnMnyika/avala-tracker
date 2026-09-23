# Deployment for the Sunny-Kookaburra assignment sheet

Create a standalone Apps Script project in the Google account that can read the assignment sheet, copy in `Code.gs`, and set these Script Properties:

| Property | Value |
| --- | --- |
| `SPREADSHEET_ID` | `1EWcaWCMsfuyXaJNTmwarLlm8o3eaU0mTsGjhgZoDNEo` |
| `SHEET_NAME` | `(New) Sunny-Kookaburra August Annotation Assignments - Corrected 4D Frames - 2026-09-09` |

Deploy **Web app** with *Execute as: Me* and limit access to your organisation/account. Copy the deployment `/exec` URL into the Avala dashboard’s **Apps Script endpoint** field and press **Sync assignments**.

The endpoint is intentionally bound server-side to this workbook and sheet. Do not change it to accept arbitrary spreadsheet IDs from the extension.
