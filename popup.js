const statusText = document.querySelector("#status");
const currentProject = document.querySelector("#currentProject");
const currentDataset = document.querySelector("#currentDataset");
const timeRunning = document.querySelector("#timeRunning");
const todaySummary = document.querySelector("#todaySummary");
const trackButton = document.querySelector("#trackButton");
const dashboardButton = document.querySelector("#dashboardButton");
const exportButton = document.querySelector("#exportButton");
const manageButton = document.querySelector("#manageProjectsButton");
const syncButton = document.querySelector("#syncButton");
const syncSummary = document.querySelector("#syncSummary");

trackButton.addEventListener("click", trackCurrentTab);
dashboardButton.addEventListener("click", openDashboard);
exportButton?.addEventListener("click", exportProjects);
manageButton?.addEventListener("click", openManage);
syncButton?.addEventListener("click", syncSpreadsheet);

window.addEventListener("load", refreshState);
setInterval(refreshState, 30000);

async function refreshState() {
  const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  const state = response?.state || {};
  const records = state.records || [];
  const activeTask = (state.tasks || []).find((task) => task.id === state.activeTaskId) || (state.assignments || {})[state.activeTaskId] || null;
  const assignments = Object.values(state.assignments || {});
  const mine = assignments.filter((assignment) => String(assignment.annotator || "").trim().toLowerCase() === String(state.settings?.annotatorName || "John Mnyika").trim().toLowerCase());
  const todayTasks = records.filter((record) => new Date(record.endTime) >= startOfDay(new Date())).length;
  const activeSession = (state.sessions || []).find((session) => session.id === state.activeSessionId);
  const todayMinutes = Math.round(records.filter((record) => new Date(record.endTime) >= startOfDay(new Date())).reduce((sum, record) => sum + Number(record.durationMs || 0), 0) / 60000);
  const activeMinutes = Math.round(Number(activeSession?.activeMs || activeSession?.durationMs || 0) / 60000);
  currentProject.textContent = activeTask?.assignmentId || activeTask?.projectType || "Unknown";
  currentDataset.textContent = activeTask?.camera || activeTask?.dataset || "—";
  timeRunning.textContent = `${Math.max(activeSession ? activeMinutes : todayMinutes, 0)}m`;
  todaySummary.textContent = mine.length ? `${mine.filter((assignment) => assignment.status === "Complete").length}/${mine.length} complete` : `${todayTasks} tasks`;
  syncSummary.textContent = state.sync?.lastError ? "Sync failed" : state.sync?.lastSuccessAt ? `Synced ${new Date(state.sync.lastSuccessAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not synced";
  statusText.textContent = activeTask ? `Tracking ${activeTask.title || `${activeTask.camera || "Task"} — ${activeTask.frame || ""}`}` : "Sync the spreadsheet to load your assignments.";
}

async function trackCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  let result;
  try {
    result = await chrome.tabs.sendMessage(tab.id, { type: "GET_CURRENT_AVALA_VIEW_URL" });
  } catch (_error) {
    statusText.textContent = "Open an Avala view before tracking it.";
    return;
  }

  if (result?.status === "not-found") {
    statusText.textContent = "⚠ Could not find “Copy link to this view”.";
  } else if (!result?.url) {
    statusText.textContent = "⚠ Could not retrieve the view link. Please try again.";
  } else {
    statusText.textContent = "✓ Avala view detected.";
  }
  await refreshState();
}

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
}

function openManage() {
  chrome.tabs.create({ url: chrome.runtime.getURL("manage.html") });
}

async function exportProjects() {
  const response = await chrome.runtime.sendMessage({ type: "EXPORT_DATA", format: "json" });
  const blobUrl = response?.blobUrl;
  if (!blobUrl) return;
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = "avala-dashboard-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  statusText.textContent = "Dashboard export started.";
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

async function syncSpreadsheet() {
  statusText.textContent = "Syncing spreadsheet…";
  const response = await chrome.runtime.sendMessage({ type: "SYNC_SPREADSHEET" });
  statusText.textContent = response?.ok ? "Spreadsheet synced." : (response?.state?.sync?.lastError || response?.error || "Spreadsheet sync failed.");
  await refreshState();
}
