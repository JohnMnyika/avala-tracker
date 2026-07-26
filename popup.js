const statusText = document.querySelector("#status");
const currentProject = document.querySelector("#currentProject");
const currentDataset = document.querySelector("#currentDataset");
const timeRunning = document.querySelector("#timeRunning");
const todaySummary = document.querySelector("#todaySummary");
const trackButton = document.querySelector("#trackButton");
const dashboardButton = document.querySelector("#dashboardButton");
const exportButton = document.querySelector("#exportButton");
const manageButton = document.querySelector("#manageProjectsButton");

trackButton.addEventListener("click", trackCurrentTab);
dashboardButton.addEventListener("click", openDashboard);
exportButton?.addEventListener("click", exportProjects);
manageButton?.addEventListener("click", openManage);

window.addEventListener("load", refreshState);
setInterval(refreshState, 30000);

async function refreshState() {
  const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  const state = response?.state || {};
  const records = state.records || [];
  const activeTask = (state.tasks || []).find((task) => task.id === state.activeTaskId) || null;
  const todayTasks = records.filter((record) => new Date(record.endTime) >= startOfDay(new Date())).length;
  const todayMinutes = Math.round(records.filter((record) => new Date(record.endTime) >= startOfDay(new Date())).reduce((sum, record) => sum + Number(record.durationMs || 0), 0) / 60000);
  currentProject.textContent = activeTask?.projectType || "Unknown";
  currentDataset.textContent = activeTask?.dataset || "—";
  timeRunning.textContent = `${Math.max(todayMinutes, 0)}m`;
  todaySummary.textContent = `${todayTasks} tasks`;
  statusText.textContent = activeTask ? `Tracking ${activeTask.title}` : "Avala tasks are tracked automatically when opened.";
}

async function trackCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const response = await chrome.runtime.sendMessage({ type: "TRACK_CURRENT_URL", url: tab.url, tabId: tab.id });
  statusText.textContent = response?.record
    ? `Tracked ${response.record.dataset || response.record.projectType || "Avala task"}.`
    : "This tab is not an Avala job link.";
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
