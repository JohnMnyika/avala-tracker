#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cat <<MESSAGE
Avala Work Tracker is ready.

Load it in Chrome:
1. Open chrome://extensions
2. Enable Developer mode
3. Click "Load unpacked"
4. Select: ${PROJECT_DIR}

Then open an Avala job link and use the extension popup to open the dashboard.
MESSAGE
