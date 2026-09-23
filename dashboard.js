const STORAGE_KEY = "avalaWorkRecords";
const TASKS_KEY = "avalaTasks";
const SESSIONS_KEY = "avalaSessions";
const DATASETS_KEY = "avalaDatasets";
const PROJECTS_KEY = "avalaProjects";
const SETTINGS_KEY = "avalaSettings";
const ACTIVE_TASK_KEY = "avalaActiveTaskId";
const ACTIVE_SESSION_KEY = "avalaActiveSession";
const DEFAULT_SETTINGS = {
  darkMode: true,
  ratePerTask: 0,
  dailyGoal: 20,
  notifiedGoalDate: "",
  targetHours: 6,
  targetTasks: 20,
  targetDatasets: 5
};

const elements = {
  activityBody: document.querySelector("#activityBody"),
  datasetStatsBody: document.querySelector("#datasetStatsBody"),
  cameraStatsBody: document.querySelector("#cameraStatsBody"),
  searchInput: document.querySelector("#searchInput"),
  datasetFilter: document.querySelector("#datasetFilter"),
  cameraFilter: document.querySelector("#cameraFilter"),
  rateInput: document.querySelector("#rateInput"),
  goalInput: document.querySelector("#goalInput"),
  themeButton: document.querySelector("#themeButton"),
  refreshButton: document.querySelector("#refreshButton"),
  exportButton: document.querySelector("#exportButton"),
  clearButton: document.querySelector("#clearButton"),
  toast: document.querySelector("#toast"),
  annotatorInput: document.querySelector("#annotatorInput"),
  spreadsheetUrlInput: document.querySelector("#spreadsheetUrlInput"),
  spreadsheetEndpointInput: document.querySelector("#spreadsheetEndpointInput"),
  assignmentIdInput: document.querySelector("#assignmentIdInput"),
  syncButton: document.querySelector("#syncButton"),
  syncStatus: document.querySelector("#syncStatus"),
  sheetPasteInput: document.querySelector("#sheetPasteInput"),
  importPasteButton: document.querySelector("#importPasteButton")
};

elements.projectsCount = document.querySelector("#projectsCount");
elements.projectsList = document.querySelector("#projectsList");
elements.addBurroBtn = document.querySelector("#addBurroBtn");

elements.summary = {
  todayTasks: document.querySelector("#todayTasks"),
  todayTime: document.querySelector("#todayTime"),
  weekTasks: document.querySelector("#weekTasks"),
  monthTasks: document.querySelector("#monthTasks"),
  weekTime: document.querySelector("#weekTime"),
  monthTime: document.querySelector("#monthTime"),
  avgTime: document.querySelector("#avgTime"),
  tasksPerHour: document.querySelector("#tasksPerHour"),
  estimatedEarnings: document.querySelector("#estimatedEarnings")
};

let records = [];
let tasks = [];
let sessions = [];
let datasets = {};
let projects = {};
let settings = { ...DEFAULT_SETTINGS };
let activeTaskId = "";
let activeSessionId = "";
let assignments = {};
let workLog = [];
let sync = {};

const STORAGE_KEYS = { records: STORAGE_KEY, tasks: TASKS_KEY, sessions: SESSIONS_KEY, datasets: DATASETS_KEY, projects: PROJECTS_KEY, settings: SETTINGS_KEY, activeTask: ACTIVE_TASK_KEY, activeSession: ACTIVE_SESSION_KEY };

document.addEventListener("DOMContentLoaded", init);
setInterval(() => {
  if (activeTaskId || activeSessionId) render();
}, 30000);

elements.refreshButton.addEventListener("click", loadState);
elements.searchInput.addEventListener("input", render);
elements.datasetFilter.addEventListener("change", render);
elements.cameraFilter.addEventListener("change", render);
elements.exportButton.addEventListener("click", exportDashboardData);
elements.clearButton.addEventListener("click", clearRecords);
elements.themeButton.addEventListener("click", toggleTheme);
elements.rateInput.addEventListener("input", saveSettingsFromInputs);
elements.goalInput.addEventListener("input", saveSettingsFromInputs);
elements.addBurroBtn?.addEventListener("click", addBurroProject);
elements.syncButton?.addEventListener("click", syncSpreadsheet);
elements.importPasteButton?.addEventListener("click", importPastedAssignments);
elements.annotatorInput?.addEventListener("change", saveSpreadsheetSettings);
elements.spreadsheetUrlInput?.addEventListener("change", saveSpreadsheetSettings);
elements.spreadsheetEndpointInput?.addEventListener("change", saveSpreadsheetSettings);
elements.assignmentIdInput?.addEventListener("change", saveSpreadsheetSettings);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[ACTIVE_TASK_KEY]) activeTaskId = changes[ACTIVE_TASK_KEY].newValue || "";
  if (changes[ACTIVE_SESSION_KEY]) activeSessionId = changes[ACTIVE_SESSION_KEY].newValue || "";
  if (changes[STORAGE_KEY]) records = normalizeRecords(changes[STORAGE_KEY].newValue || []);
  if (changes[TASKS_KEY]) tasks = changes[TASKS_KEY].newValue || [];
  if (changes[SESSIONS_KEY]) sessions = changes[SESSIONS_KEY].newValue || [];
  if (changes[DATASETS_KEY]) datasets = changes[DATASETS_KEY].newValue || {};
  if (changes[PROJECTS_KEY]) projects = changes[PROJECTS_KEY].newValue || {};
  if (changes[SETTINGS_KEY]) settings = { ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue || {}) };
  if (changes.avalaSpreadsheetAssignments) assignments = changes.avalaSpreadsheetAssignments.newValue || {};
  if (changes.avalaWorkLog) workLog = changes.avalaWorkLog.newValue || [];
  if (changes.avalaSpreadsheetSync) sync = changes.avalaSpreadsheetSync.newValue || {};
  applySettingsToControls();
  render();
});

async function init() {
  await loadState();
}

async function loadState() {
  const result = await chrome.storage.local.get({
    [STORAGE_KEY]: [],
    [TASKS_KEY]: [],
    [SESSIONS_KEY]: [],
    [DATASETS_KEY]: {},
    [PROJECTS_KEY]: {},
    [SETTINGS_KEY]: DEFAULT_SETTINGS,
    [ACTIVE_TASK_KEY]: "",
    [ACTIVE_SESSION_KEY]: ""
  });
  activeTaskId = result[ACTIVE_TASK_KEY] || "";
  activeSessionId = result[ACTIVE_SESSION_KEY] || "";
  records = normalizeRecords(result[STORAGE_KEY]);
  tasks = Array.isArray(result[TASKS_KEY]) ? result[TASKS_KEY] : [];
  sessions = Array.isArray(result[SESSIONS_KEY]) ? result[SESSIONS_KEY] : [];
  datasets = result[DATASETS_KEY] || {};
  projects = result[PROJECTS_KEY] || {};
  settings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  assignments = result.avalaSpreadsheetAssignments || {};
  workLog = result.avalaWorkLog || [];
  sync = result.avalaSpreadsheetSync || {};
  renderProjects(projects);
  applySettingsToControls();
  render();
}

function renderProjects(projectsMap) {
  const listEl = elements.projectsList;
  const keys = Object.keys(projectsMap || {}).sort();
  elements.projectsCount && (elements.projectsCount.textContent = `${keys.length}`);
  listEl.replaceChildren();
  if (!keys.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No projects tracked yet.";
    listEl.appendChild(p);
    return;
  }
  const ul = document.createElement("ul");
  for (const key of keys) {
    const project = projectsMap[key];
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = project.url || "#";
    a.target = "_blank";
    a.textContent = project.title || key;
    li.appendChild(a);
    if (project.dataset || project.projectType) {
      const small = document.createElement("small");
      small.textContent = ` — ${project.projectType || "Avala"}${project.dataset ? ` · ${project.dataset}` : ""}`;
      li.appendChild(small);
    }
    ul.appendChild(li);
  }
  listEl.appendChild(ul);
}

async function addBurroProject() {
  const key = "burro-segmentation";
  const project = {
    title: "Burro Segmentation",
    dataset: "Burro",
    projectType: "Burro Segmentation",
    slices: [],
    url: "https://avala.ai/@burro/slices/20260402t103311-0400-label/items/5a4d528e-59f3-44b5-ae80-9d9e8847f8a6",
    firstSeenAt: new Date().toISOString()
  };
  const res = await chrome.storage.local.get({ [PROJECTS_KEY]: {} });
  const projectsMap = res[PROJECTS_KEY] || {};
  projectsMap[key] = project;
  await chrome.storage.local.set({ [PROJECTS_KEY]: projectsMap });
  projects = projectsMap;
  renderProjects(projects);
  showToast("Added Burro Segmentation to the dashboard.");
}

function normalizeRecords(sourceRecords) {
  const now = new Date().toISOString();
  return (Array.isArray(sourceRecords) ? sourceRecords : []).map((record) => {
    const startTime = record.startTime || record.firstSeenAt || record.lastSeenAt;
    const endTime = record.id === activeTaskId ? now : record.endTime || record.lastSeenAt || startTime;
    return {
      ...record,
      startTime,
      endTime,
      durationMs: Number.isFinite(record.durationMs) ? record.durationMs : calculateDurationMs(startTime, endTime)
    };
  }).sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
}

function render() {
  const filtered = getFilteredRecords();
  const periods = getPeriodRecords(filtered);
  const overview = buildOverviewData(filtered, periods);
  renderFilterOptions(records);
  renderMetrics(overview, periods);
  renderCharts(filtered, periods);
  renderAnalytics(filtered, periods);
  renderTables(filtered);
  renderSpreadsheetWorkflow();
  renderProjects(projects);
  checkGoalNotification(periods.today.length);
}

function getFilteredRecords() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const dataset = elements.datasetFilter.value;
  const projectType = elements.cameraFilter.value;
  return records.filter((record) => {
    const haystack = [record.dataset, record.projectType, record.sequenceId, record.slice, record.itemId, record.workUnitUid, record.url].join(" ").toLowerCase();
    return (!dataset || record.dataset === dataset) &&
      (!projectType || record.projectType === projectType) &&
      (!query || haystack.includes(query));
  });
}

function getPeriodRecords(sourceRecords) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    today: sourceRecords.filter((record) => new Date(record.endTime) >= todayStart),
    week: sourceRecords.filter((record) => new Date(record.endTime) >= weekStart),
    month: sourceRecords.filter((record) => new Date(record.endTime) >= monthStart)
  };
}

function buildOverviewData(sourceRecords, periods) {
  const todayDuration = sumDuration(periods.today);
  const weekDuration = sumDuration(periods.week);
  const monthDuration = sumDuration(periods.month);
  const totalDuration = sumDuration(sourceRecords);
  const totalHours = totalDuration / 3600000;
  const avgDuration = sourceRecords.length ? totalDuration / sourceRecords.length : 0;
  const projectsSeen = new Set(sourceRecords.map((record) => record.projectType).filter(Boolean));
  const datasetsSeen = new Set(sourceRecords.map((record) => record.dataset).filter(Boolean));
  const longestSession = sourceRecords.reduce((best, record) => (record.durationMs > best.durationMs ? record : best), { durationMs: 0 });
  const shortestSession = sourceRecords.reduce((best, record) => (record.durationMs < best.durationMs && record.durationMs > 0 ? record : best), { durationMs: Number.POSITIVE_INFINITY });
  return {
    todayDuration,
    weekDuration,
    monthDuration,
    totalDuration,
    totalHours,
    avgDuration,
    todayTasks: periods.today.length,
    weekTasks: periods.week.length,
    monthTasks: periods.month.length,
    projectsSeen,
    datasetsSeen,
    longestSession,
    shortestSession,
    taskRate: totalHours > 0 ? sourceRecords.length / totalHours : 0,
    earnings: sourceRecords.length * Number(settings.ratePerTask || 0)
  };
}

function renderMetrics(overview, periods) {
  const mostWorkedDataset = Object.entries(groupBy(records, "dataset")).sort((a, b) => b[1].tasks - a[1].tasks)[0]?.[0] || "—";
  const mostWorkedProject = Object.entries(groupBy(records, "projectType")).sort((a, b) => b[1].tasks - a[1].tasks)[0]?.[0] || "—";
  const activeLabel = tasks.find((task) => task.id === activeTaskId)?.title || "—";
  const weeklyHours = Math.round(sumDuration(periods.week) / 3600000);
  const monthlyHours = Math.round(sumDuration(periods.month) / 3600000);
  const longestMinutes = Math.round(Math.max(0, overview.longestSession.durationMs || 0) / 60000);
  const shortestMinutes = Math.round(Math.min(Number.POSITIVE_INFINITY, overview.shortestSession.durationMs || 0) / 60000);
  const score = records.length ? Math.min(100, Math.round((overview.todayTasks / Math.max(1, Number(settings.dailyGoal || 20))) * 100)) : 0;

  setText("todayTasks", overview.todayTasks);
  setText("weekTasks", overview.weekTasks);
  setText("monthTasks", overview.monthTasks);
  setText("todayTime", formatDuration(overview.todayDuration));
  setText("weekTime", formatDuration(overview.weekDuration));
  setText("monthTime", formatDuration(overview.monthDuration));
  setText("avgTime", formatDuration(overview.avgDuration));
  setText("tasksPerHour", overview.taskRate > 0 ? overview.taskRate.toFixed(2) : "0");
  setText("estimatedEarnings", formatMoney(overview.earnings));
  setText("dailyTrend", `${overview.todayTasks} tasks today`);
  setText("weeklyTrend", `${overview.weekTasks} tasks this week`);
  setText("monthlyTrend", `${overview.monthTasks} tasks this month`);
  setText("mostWorkedDataset", mostWorkedDataset);
  setText("mostWorkedProject", mostWorkedProject);
  setText("activeTask", activeLabel);
  setText("weeklyHours", `${weeklyHours}h`);
  setText("monthlyHours", `${monthlyHours}h`);
  setText("longestSession", `${longestMinutes}m`);
  setText("shortestSession", `${shortestMinutes}m`);
  setText("totalSessions", `${sessions.length}`);
  setText("productivityScore", `${score}%`);
  setText("highlightDataset", mostWorkedDataset);
  setText("highlightProject", mostWorkedProject);
  setText("highlightActive", activeLabel);
  setText("highlightSessions", `${sessions.length}`);
  setText("timelineCount", `${records.slice(0, 8).length} events`);
}

function renderFilterOptions(sourceRecords) {
  updateSelect(elements.datasetFilter, "All datasets", unique(sourceRecords.map((record) => record.dataset).filter(Boolean)));
  updateSelect(elements.cameraFilter, "All projects", unique(sourceRecords.map((record) => record.projectType).filter(Boolean)));
}

function updateSelect(select, defaultLabel, values) {
  const selected = select.value;
  select.replaceChildren(new Option(defaultLabel, ""));
  for (const value of values) select.append(new Option(value, value));
  select.value = values.includes(selected) ? selected : "";
}

function renderCharts(sourceRecords, periods) {
  const daily = rollingBuckets(7, "day", sourceRecords);
  const weekly = rollingBuckets(6, "week", sourceRecords);
  const monthly = rollingBuckets(6, "month", sourceRecords);
  const datasetTime = Object.entries(groupBy(sourceRecords, "dataset")).slice(0, 8).map(([label, value]) => ({ label, value: value.durationMs / 3600000 }));
  const projectTime = Object.entries(groupBy(sourceRecords, "projectType")).slice(0, 8).map(([label, value]) => ({ label, value: value.durationMs / 3600000 }));
  drawBarChart("dailyChart", daily);
  drawLineChart("weeklyChart", weekly);
  drawLineChart("monthlyChart", monthly);
  drawBarChart("datasetTimeChart", datasetTime);
  drawBarChart("cameraTimeChart", projectTime);
  setText("weeklyReportTasks", periods.week.length);
  setText("weeklyReportTime", formatDuration(sumDuration(periods.week)));
  setText("monthlyReportTasks", periods.month.length);
  setText("monthlyReportTime", formatDuration(sumDuration(periods.month)));
}

function rollingBuckets(count, unit, sourceRecords) {
  const buckets = [];
  const now = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = shiftDate(now, unit, -index);
    const bucketStart = unit === "day" ? startOfDay(start) : unit === "week" ? startOfWeek(start) : new Date(start.getFullYear(), start.getMonth(), 1);
    const bucketEnd = shiftDate(bucketStart, unit, 1);
    buckets.push({
      label: formatBucketLabel(bucketStart, unit),
      value: sourceRecords.filter((record) => {
        const end = new Date(record.endTime);
        return end >= bucketStart && end < bucketEnd;
      }).length
    });
  }
  return buckets;
}

function renderAnalytics(sourceRecords) {
  const ranking = Object.entries(groupBy(sourceRecords, "dataset")).slice(0, 5);
  const list = document.querySelector("#datasetRanking");
  list.replaceChildren();
  setText("topDataset", ranking[0] ? `${ranking[0][1].tasks} tasks` : "-");
  for (const [label, item] of ranking) {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    title.textContent = label;
    meta.textContent = `${item.tasks} tasks · ${formatDuration(item.durationMs)} · ${formatMoney(item.tasks * Number(settings.ratePerTask || 0))}`;
    li.append(title, meta);
    list.append(li);
  }
  setText("projectsCount", `${Object.keys(projects || {}).length}`);
}

function renderTables(sourceRecords) {
  renderActivityTable(sourceRecords);
  renderDatasetStats(sourceRecords);
  renderProjectStats(sourceRecords);
  renderTimeline(sourceRecords);
}

function renderTimeline(sourceRecords) {
  const list = document.querySelector("#timelineList");
  list.replaceChildren();
  const events = sourceRecords.slice(0, 8).map((record) => ({
    title: record.title || `${record.projectType || "Avala"} task`,
    detail: `${record.projectType || "Unknown"} · ${record.dataset || "Untracked"} · ${formatDuration(record.durationMs)}`
  }));

  if (!events.length) {
    const li = document.createElement("li");
    li.textContent = "No Avala activity yet. Open a task to start the timeline.";
    list.appendChild(li);
    return;
  }

  for (const event of events) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = event.title;
    const small = document.createElement("small");
    small.textContent = event.detail;
    li.append(strong, small);
    list.appendChild(li);
  }
}

function renderActivityTable(sourceRecords) {
  const wrap = elements.activityBody.closest(".tableWrap");
  elements.activityBody.replaceChildren();
  wrap.classList.toggle("is-empty", sourceRecords.length === 0);
  setText("activityCount", `${sourceRecords.length} records`);

  for (const record of sourceRecords.slice(0, 100)) {
    const row = document.createElement("tr");
    row.append(
      cell(record.projectType || "Unknown Project"),
      cell(record.dataset || "—"),
      cell(formatDateTime(record.startTime)),
      cell(formatDateTime(record.endTime)),
      cell(formatDuration(record.durationMs)),
      linkCell(record.url)
    );
    elements.activityBody.append(row);
  }
}

function renderDatasetStats(sourceRecords) {
  const grouped = Object.entries(groupBy(sourceRecords, "dataset"));
  elements.datasetStatsBody.replaceChildren();
  setText("datasetCount", `${grouped.length} datasets`);
  for (const [label, item] of grouped) {
    const row = document.createElement("tr");
    row.append(cell(label), cell(item.tasks), cell(formatDuration(item.durationMs)));
    elements.datasetStatsBody.append(row);
  }
}

function renderProjectStats(sourceRecords) {
  const grouped = Object.entries(groupBy(sourceRecords, "projectType"));
  elements.cameraStatsBody.replaceChildren();
  setText("cameraCount", `${grouped.length} projects`);
  for (const [label, item] of grouped) {
    const row = document.createElement("tr");
    row.append(cell(label), cell(item.tasks));
    elements.cameraStatsBody.append(row);
  }
}

function drawBarChart(id, data) {
  const canvas = document.querySelector(`#${id}`);
  const context = prepareCanvas(canvas);
  const colors = chartColors();
  const max = Math.max(1, ...data.map((item) => item.value));
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 16, right: 12, bottom: 36, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  context.clearRect(0, 0, width, height);
  drawGrid(context, padding, width, height);

  data.forEach((item, index) => {
    const slot = plotWidth / Math.max(data.length, 1);
    const barWidth = Math.max(8, slot * 0.56);
    const barHeight = (item.value / max) * plotHeight;
    const x = padding.left + index * slot + (slot - barWidth) / 2;
    const y = padding.top + plotHeight - barHeight;
    context.fillStyle = index % 2 ? colors.accent2 : colors.accent;
    context.fillRect(x, y, barWidth, barHeight);
    drawLabel(context, item.label, x + barWidth / 2, height - 12);
  });
}

function drawLineChart(id, data) {
  const canvas = document.querySelector(`#${id}`);
  const context = prepareCanvas(canvas);
  const colors = chartColors();
  const max = Math.max(1, ...data.map((item) => item.value));
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 16, right: 16, bottom: 36, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  context.clearRect(0, 0, width, height);
  drawGrid(context, padding, width, height);

  context.beginPath();
  data.forEach((item, index) => {
    const x = padding.left + (plotWidth / Math.max(data.length - 1, 1)) * index;
    const y = padding.top + plotHeight - (item.value / max) * plotHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = colors.accent2;
  context.lineWidth = 3;
  context.stroke();

  data.forEach((item, index) => {
    const x = padding.left + (plotWidth / Math.max(data.length - 1, 1)) * index;
    const y = padding.top + plotHeight - (item.value / max) * plotHeight;
    context.fillStyle = colors.accent3;
    context.beginPath();
    context.arc(x, y, 4, 0, Math.PI * 2);
    context.fill();
    drawLabel(context, item.label, x, height - 12);
  });
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));
  return canvas.getContext("2d");
}

function drawGrid(context, padding, width, height) {
  context.strokeStyle = chartColors().grid;
  context.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    const y = padding.top + ((height - padding.top - padding.bottom) / 3) * index;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
  }
}

function drawLabel(context, text, x, y) {
  context.fillStyle = getComputedStyle(document.body).getPropertyValue("--muted") || "#607080";
  context.font = "12px Inter, sans-serif";
  context.textAlign = "center";
  context.fillText(text, x, y);
}

function chartColors() {
  const computed = getComputedStyle(document.body);
  return {
    accent: computed.getPropertyValue("--accent").trim() || "#0f766e",
    accent2: computed.getPropertyValue("--accent-2").trim() || "#2563eb",
    accent3: computed.getPropertyValue("--accent-3").trim() || "#d97706",
    grid: computed.getPropertyValue("--chart-grid").trim() || "#e4ebf1"
  };
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  settings.darkMode = document.body.classList.contains("dark");
  chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  showToast(settings.darkMode ? "Dark mode enabled" : "Light mode enabled");
}

async function saveSettingsFromInputs() {
  settings.ratePerTask = Number(elements.rateInput.value || 0);
  settings.dailyGoal = Number(elements.goalInput.value || 20);
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  render();
}

function applySettingsToControls() {
  elements.rateInput.value = settings.ratePerTask || 0;
  elements.goalInput.value = settings.dailyGoal || 20;
  document.body.classList.toggle("dark", Boolean(settings.darkMode));
  elements.themeButton.textContent = settings.darkMode ? "Light Mode" : "Dark Mode";
}

async function exportDashboardData() {
  const payload = {
    records,
    tasks,
    sessions,
    datasets,
    projects,
    settings,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `avala-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Dashboard export created.");
}

async function clearRecords() {
  await chrome.storage.local.set({ [STORAGE_KEY]: [], [TASKS_KEY]: [], [SESSIONS_KEY]: [], [DATASETS_KEY]: {}, [PROJECTS_KEY]: {}, [SETTINGS_KEY]: DEFAULT_SETTINGS, [ACTIVE_TASK_KEY]: "", [ACTIVE_SESSION_KEY]: "" });
  records = [];
  tasks = [];
  sessions = [];
  datasets = {};
  projects = {};
  settings = { ...DEFAULT_SETTINGS };
  render();
  showToast("Tracker state cleared.");
}

function checkGoalNotification(taskCount) {
  if (!settings.dailyGoal || settings.dailyGoal <= 0) return;
  const date = new Date().toISOString().slice(0, 10);
  if (settings.notifiedGoalDate === date && taskCount < settings.dailyGoal) return;
  if (taskCount >= settings.dailyGoal) {
    showToast(`Goal reached: ${settings.dailyGoal} tasks today.`);
    settings.notifiedGoalDate = date;
    chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function setText(id, value) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = value;
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "0m";
  const totalMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "—";
}

function sumDuration(recordsList) {
  return recordsList.reduce((total, record) => total + Number(record.durationMs || 0), 0);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function groupBy(sourceRecords, field) {
  return sourceRecords.reduce((acc, record) => {
    const key = record[field] || "Unknown";
    if (!acc[key]) {
      acc[key] = { label: key, tasks: 0, durationMs: 0 };
    }
    acc[key].tasks += 1;
    acc[key].durationMs += Number(record.durationMs || 0);
    return acc;
  }, {});
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function shiftDate(date, unit, count) {
  const result = new Date(date);
  if (unit === "day") result.setDate(result.getDate() + count);
  else if (unit === "week") result.setDate(result.getDate() + count * 7);
  else if (unit === "month") result.setMonth(result.getMonth() + count);
  return result;
}

function formatBucketLabel(date, unit) {
  if (unit === "day") return date.toLocaleDateString([], { month: "short", day: "numeric" });
  if (unit === "week") return `W${date.getWeek()}`;
  return date.toLocaleDateString([], { month: "short" });
}

Date.prototype.getWeek = function getWeek() {
  const date = new Date(this.getTime());
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

function calculateDurationMs(startTime, endTime) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
}

function cell(value) {
  const td = document.createElement("td");
  td.textContent = value ?? "—";
  return td;
}

function linkCell(url) {
  const td = document.createElement("td");
  if (!url) {
    td.textContent = "—";
    return td;
  }
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Open";
  td.appendChild(link);
  return td;
}

function applySettingsToControls() {
  document.body.classList.toggle("dark", Boolean(settings.darkMode));
  elements.themeButton.textContent = settings.darkMode ? "Light Mode" : "Dark Mode";
  elements.rateInput.value = settings.ratePerTask;
  elements.goalInput.value = settings.dailyGoal;
  if (elements.annotatorInput) elements.annotatorInput.value = settings.annotatorName || "John Mnyika";
  if (elements.spreadsheetUrlInput) elements.spreadsheetUrlInput.value = settings.spreadsheetUrl || "";
  if (elements.spreadsheetEndpointInput) elements.spreadsheetEndpointInput.value = settings.spreadsheetEndpoint || "";
  if (elements.assignmentIdInput) elements.assignmentIdInput.value = settings.assignmentId || "";
}

async function checkGoalNotification(todayTasks) {
  const goal = Number(settings.dailyGoal || 0);
  const todayKey = new Date().toISOString().slice(0, 10);
  if (!goal || todayTasks < goal || settings.notifiedGoalDate === todayKey) return;

  settings = { ...settings, notifiedGoalDate: todayKey };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  showToast(`Daily productivity goal reached: ${todayTasks} tasks.`);

  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("Avala goal reached", {
        body: `You completed ${todayTasks} tasks today.`
      });
    }
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  setTimeout(() => elements.toast.classList.remove("show"), 4200);
}

function exportCsv() {
  const rows = [
    ["dataset", "camera", "start_time", "end_time", "duration", "sequence", "work_unit_uid", "visits", "url"],
    ...getFilteredRecords().map((record) => [
      record.dataset,
      record.camera,
      record.startTime,
      record.endTime,
      formatDuration(record.durationMs),
      record.sequence,
      record.workUnitUid,
      String(record.visits || 1),
      record.url
    ])
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `avala-work-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const text = String(value || "");
  return `"${text.replaceAll('"', '""')}"`;
}

async function clearRecords() {
  if (!confirm("Clear all tracked Avala work records?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_RECORDS" });
}

function renderSpreadsheetWorkflow() {
  const mine = Object.values(assignments).filter((assignment) => String(assignment.annotator || "").trim().toLowerCase() === String(settings.annotatorName || "John Mnyika").trim().toLowerCase());
  const completed = mine.filter((assignment) => assignment.status === "Complete");
  const inProgress = mine.filter((assignment) => assignment.status === "In Progress");
  const today = new Date().toISOString().slice(0, 10);
  const completedToday = workLog.filter((entry) => String(entry.annotator || "").trim().toLowerCase() === String(settings.annotatorName || "John Mnyika").trim().toLowerCase() && String(entry.completed_at || "").slice(0, 10) === today);
  const activeMs = completedToday.reduce((sum, entry) => sum + Number(entry.active_time || 0), 0);
  setText("myAssigned", mine.length);
  setText("myInProgress", inProgress.length);
  setText("myCompleted", completed.length);
  setText("myRemaining", mine.length - completed.length);
  setText("myActiveTime", formatDuration(activeMs));
  setText("myFramesPerHour", activeMs ? (completedToday.length / (activeMs / 3600000)).toFixed(2) : "0");
  if (elements.syncStatus) elements.syncStatus.textContent = sync.lastError ? `Sync error: ${sync.lastError}` : sync.lastSuccessAt ? `Synced ${formatDateTime(sync.lastSuccessAt)}` : "Not synced";
}

async function saveSpreadsheetSettings() {
  settings = { ...settings, annotatorName: elements.annotatorInput.value.trim() || "John Mnyika", spreadsheetUrl: elements.spreadsheetUrlInput.value.trim(), spreadsheetEndpoint: elements.spreadsheetEndpointInput.value.trim(), assignmentId: elements.assignmentIdInput.value.trim() };
  await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
}

async function syncSpreadsheet() {
  await saveSpreadsheetSettings();
  elements.syncStatus.textContent = "Syncing…";
  const result = await chrome.runtime.sendMessage({ type: "SYNC_SPREADSHEET" });
  if (!result?.ok) showToast(result?.state?.sync?.lastError || result?.error || "Spreadsheet sync failed.");
  await loadState();
}

function parsePastedSheetRows(text) {
  const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines.shift().split("\t").map((header) => header.trim());
  return lines.map((line) => {
    const cells = line.split("\t");
    return headers.reduce((row, header, index) => { row[header] = (cells[index] || "").trim(); return row; }, {});
  });
}

async function importPastedAssignments() {
  const rows = parsePastedSheetRows(elements.sheetPasteInput?.value);
  if (!rows.length) { showToast("Copy the header and at least one assignment row from Google Sheets first."); return; }
  await saveSpreadsheetSettings();
  const result = await chrome.runtime.sendMessage({ type: "SYNC_SPREADSHEET", rows });
  if (!result?.ok) { showToast(result?.state?.sync?.lastError || "Import failed."); return; }
  elements.sheetPasteInput.value = "";
  showToast(`${rows.length} spreadsheet rows imported.`);
  await loadState();
}
