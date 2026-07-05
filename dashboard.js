const STORAGE_KEY = "avalaWorkRecords";
const ACTIVE_TASK_KEY = "avalaActiveTaskId";
const SETTINGS_KEY = "avalaDashboardSettings";
const DEFAULT_SETTINGS = {
  darkMode: false,
  ratePerTask: 0,
  dailyGoal: 20,
  notifiedGoalDate: ""
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
  toast: document.querySelector("#toast")
};

let records = [];
let settings = { ...DEFAULT_SETTINGS };
let activeTaskId = "";

document.addEventListener("DOMContentLoaded", init);
setInterval(() => {
  if (activeTaskId) render();
}, 30000);
elements.refreshButton.addEventListener("click", loadState);
elements.searchInput.addEventListener("input", render);
elements.datasetFilter.addEventListener("change", render);
elements.cameraFilter.addEventListener("change", render);
elements.exportButton.addEventListener("click", exportCsv);
elements.clearButton.addEventListener("click", clearRecords);
elements.themeButton.addEventListener("click", toggleTheme);
elements.rateInput.addEventListener("input", saveSettingsFromInputs);
elements.goalInput.addEventListener("input", saveSettingsFromInputs);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[ACTIVE_TASK_KEY]) activeTaskId = changes[ACTIVE_TASK_KEY].newValue || "";
  if (changes[STORAGE_KEY]) records = normalizeRecords(changes[STORAGE_KEY].newValue || []);
  if (changes[SETTINGS_KEY]) settings = { ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue || {}) };
  applySettingsToControls();
  render();
});

async function init() {
  await loadState();
}

async function loadState() {
  const result = await chrome.storage.local.get({
    [STORAGE_KEY]: [],
    [ACTIVE_TASK_KEY]: "",
    [SETTINGS_KEY]: DEFAULT_SETTINGS
  });
  activeTaskId = result[ACTIVE_TASK_KEY] || "";
  records = normalizeRecords(result[STORAGE_KEY]);
  settings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  applySettingsToControls();
  render();
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
      durationMs: Number.isFinite(record.durationMs)
        ? record.durationMs
        : calculateDurationMs(startTime, endTime)
    };
  }).sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
}

function render() {
  records = normalizeRecords(records);
  const filtered = getFilteredRecords();
  const periods = getPeriodRecords(records);
  renderFilterOptions(records);
  renderMetrics(periods);
  renderCharts(records);
  renderRankings(records);
  renderReports(periods);
  renderTables(filtered);
  checkGoalNotification(periods.today.length);
}

function getFilteredRecords() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const dataset = elements.datasetFilter.value;
  const camera = elements.cameraFilter.value;

  return records.filter((record) => {
    const haystack = [
      record.dataset,
      record.camera,
      record.sequence,
      record.workUnitUid,
      record.loadRange,
      record.preview
    ].join(" ").toLowerCase();
    return (!dataset || record.dataset === dataset) &&
      (!camera || record.camera === camera) &&
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

function renderMetrics(periods) {
  const totalDuration = sumDuration(records);
  const totalHours = totalDuration / 3600000;
  setText("todayTasks", periods.today.length);
  setText("weekTasks", periods.week.length);
  setText("monthTasks", periods.month.length);
  setText("todayTime", formatDuration(sumDuration(periods.today)));
  setText("weekTime", formatDuration(sumDuration(periods.week)));
  setText("monthTime", formatDuration(sumDuration(periods.month)));
  setText("avgTime", formatDuration(records.length ? totalDuration / records.length : 0));
  setText("tasksPerHour", totalHours > 0 ? (records.length / totalHours).toFixed(2) : "0");
  setText("estimatedEarnings", formatMoney(records.length * Number(settings.ratePerTask || 0)));
}

function renderFilterOptions(sourceRecords) {
  updateSelect(elements.datasetFilter, "All datasets", unique(sourceRecords.map((record) => record.dataset)));
  updateSelect(elements.cameraFilter, "All cameras", unique(sourceRecords.map((record) => record.camera)));
}

function updateSelect(select, defaultLabel, values) {
  const selected = select.value;
  select.replaceChildren(new Option(defaultLabel, ""));
  for (const value of values) select.append(new Option(value, value));
  select.value = values.includes(selected) ? selected : "";
}

function renderCharts(sourceRecords) {
  const daily = rollingBuckets(7, "day", sourceRecords);
  const weekly = rollingBuckets(6, "week", sourceRecords);
  const monthly = rollingBuckets(6, "month", sourceRecords);
  const datasetTime = groupBy(sourceRecords, "dataset").slice(0, 8).map((item) => ({
    label: shortLabel(item.label),
    value: item.durationMs / 3600000
  }));
  const cameraTime = groupBy(sourceRecords, "camera").map((item) => ({
    label: item.label,
    value: item.durationMs / 3600000
  }));

  drawBarChart("dailyChart", daily);
  drawLineChart("weeklyChart", weekly);
  drawLineChart("monthlyChart", monthly);
  drawBarChart("datasetTimeChart", datasetTime);
  drawBarChart("cameraTimeChart", cameraTime);

  setText("dailyTrend", trendLabel(daily));
  setText("weeklyTrend", trendLabel(weekly));
  setText("monthlyTrend", trendLabel(monthly));
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

function renderRankings(sourceRecords) {
  const ranking = groupBy(sourceRecords, "dataset").slice(0, 5);
  const list = document.querySelector("#datasetRanking");
  list.replaceChildren();
  setText("topDataset", ranking[0] ? `${ranking[0].tasks} tasks` : "-");

  for (const item of ranking) {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    title.textContent = item.label;
    meta.textContent = `${item.tasks} tasks · ${formatDuration(item.durationMs)} · ${formatMoney(item.tasks * Number(settings.ratePerTask || 0))}`;
    li.append(title, meta);
    list.append(li);
  }
}

function renderReports(periods) {
  setText("weeklyReportTasks", periods.week.length);
  setText("weeklyReportTime", formatDuration(sumDuration(periods.week)));
  setText("monthlyReportTasks", periods.month.length);
  setText("monthlyReportTime", formatDuration(sumDuration(periods.month)));
}

function renderTables(sourceRecords) {
  renderActivityTable(sourceRecords);
  renderDatasetStats(sourceRecords);
  renderCameraStats(sourceRecords);
}

function renderActivityTable(sourceRecords) {
  const wrap = elements.activityBody.closest(".tableWrap");
  elements.activityBody.replaceChildren();
  wrap.classList.toggle("is-empty", sourceRecords.length === 0);
  setText("activityCount", `${sourceRecords.length} records`);

  for (const record of sourceRecords.slice(0, 100)) {
    const row = document.createElement("tr");
    row.append(
      cell(record.dataset),
      cell(record.camera),
      cell(formatDateTime(record.startTime)),
      cell(formatDateTime(record.endTime)),
      cell(formatDuration(record.durationMs)),
      linkCell(record.url)
    );
    elements.activityBody.append(row);
  }
}

function renderDatasetStats(sourceRecords) {
  const grouped = groupBy(sourceRecords, "dataset");
  elements.datasetStatsBody.replaceChildren();
  setText("datasetCount", `${grouped.length} datasets`);
  for (const item of grouped) {
    const row = document.createElement("tr");
    row.append(cell(item.label), cell(item.tasks), cell(formatDuration(item.durationMs)));
    elements.datasetStatsBody.append(row);
  }
}

function renderCameraStats(sourceRecords) {
  const grouped = groupBy(sourceRecords, "camera");
  elements.cameraStatsBody.replaceChildren();
  setText("cameraCount", `${grouped.length} cameras`);
  for (const item of grouped) {
    const row = document.createElement("tr");
    row.append(cell(item.label), cell(item.tasks));
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
  context.fillStyle = chartColors().muted;
  context.font = "11px system-ui";
  context.textAlign = "center";
  context.fillText(text, x, y);
}

function chartColors() {
  const styles = getComputedStyle(document.body);
  return {
    accent: styles.getPropertyValue("--accent").trim(),
    accent2: styles.getPropertyValue("--accent-2").trim(),
    accent3: styles.getPropertyValue("--accent-3").trim(),
    muted: styles.getPropertyValue("--muted").trim(),
    grid: styles.getPropertyValue("--chart-grid").trim()
  };
}

function groupBy(sourceRecords, key) {
  const map = new Map();
  for (const record of sourceRecords) {
    const label = record[key] || "Unknown";
    const current = map.get(label) || { label, tasks: 0, durationMs: 0 };
    current.tasks += 1;
    current.durationMs += record.durationMs || 0;
    map.set(label, current);
  }
  return [...map.values()].sort((a, b) => b.tasks - a.tasks || b.durationMs - a.durationMs);
}

function sumDuration(sourceRecords) {
  return sourceRecords.reduce((sum, record) => sum + (record.durationMs || 0), 0);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function cell(text) {
  const element = document.createElement("td");
  element.textContent = text || "-";
  return element;
}

function linkCell(url) {
  const element = document.createElement("td");
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Open";
  element.append(link);
  return element;
}

function setText(id, value) {
  document.querySelector(`#${id}`).textContent = String(value);
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round((ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value || 0);
}

function calculateDurationMs(startTime, endTime) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = startOfDay(date);
  start.setDate(start.getDate() - diff);
  return start;
}

function shiftDate(date, unit, amount) {
  const shifted = new Date(date);
  if (unit === "day") shifted.setDate(shifted.getDate() + amount);
  if (unit === "week") shifted.setDate(shifted.getDate() + amount * 7);
  if (unit === "month") shifted.setMonth(shifted.getMonth() + amount);
  return shifted;
}

function formatBucketLabel(date, unit) {
  if (unit === "day") return date.toLocaleDateString([], { weekday: "short" });
  if (unit === "week") return `${date.getMonth() + 1}/${date.getDate()}`;
  return date.toLocaleDateString([], { month: "short" });
}

function shortLabel(value) {
  if (!value || value.length <= 12) return value || "-";
  return `${value.slice(0, 10)}...`;
}

function trendLabel(data) {
  if (data.length < 2) return "-";
  const previous = data[data.length - 2].value;
  const current = data[data.length - 1].value;
  const diff = current - previous;
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return String(diff);
  return "steady";
}

async function saveSettingsFromInputs() {
  settings = {
    ...settings,
    ratePerTask: Number(elements.rateInput.value || 0),
    dailyGoal: Number(elements.goalInput.value || DEFAULT_SETTINGS.dailyGoal)
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  render();
}

async function toggleTheme() {
  settings = { ...settings, darkMode: !settings.darkMode };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

function applySettingsToControls() {
  document.body.classList.toggle("dark", Boolean(settings.darkMode));
  elements.themeButton.textContent = settings.darkMode ? "Light Mode" : "Dark Mode";
  elements.rateInput.value = settings.ratePerTask;
  elements.goalInput.value = settings.dailyGoal;
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
