importScripts("avalaParser.js");

const STORAGE_KEY = "avalaWorkRecords";
const TASKS_KEY = "avalaTasks";
const SESSIONS_KEY = "avalaSessions";
const DATASETS_KEY = "avalaDatasets";
const PROJECTS_KEY = "avalaProjects";
const SETTINGS_KEY = "avalaSettings";
const ACTIVE_SESSION_KEY = "avalaActiveSession";
const ACTIVE_TASK_KEY = "avalaActiveTaskId";
const recentTracks = new Map();
const DUPLICATE_WINDOW_MS = 15000;
const DEFAULT_SETTINGS = {
  darkMode: true,
  notifications: true,
  autoBackup: true,
  targetHours: 6,
  targetTasks: 20,
  targetDatasets: 5,
  defaultExportFormat: "json",
  idleThresholdMinutes: 5,
  timezone: "UTC"
};

function createDefaultProject() {
  return {
    title: "Burro Segmentation",
    dataset: "Burro",
    projectType: "Burro Segmentation",
    slices: [],
    url: "https://avala.ai/@burro/slices/20260402t103311-0400-label/items/5a4d528e-59f3-44b5-ae80-9d9e8847f8a6",
    firstSeenAt: new Date().toISOString()
  };
}

async function ensureDefaults() {
  try {
    const result = await chrome.storage.local.get({
      [PROJECTS_KEY]: {},
      [SETTINGS_KEY]: DEFAULT_SETTINGS,
      [TASKS_KEY]: [],
      [SESSIONS_KEY]: [],
      [DATASETS_KEY]: {},
      [STORAGE_KEY]: []
    });
    const projects = result[PROJECTS_KEY] || {};
    const settings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
    if (!projects["burro-segmentation"]) {
      projects["burro-segmentation"] = createDefaultProject();
    }
    await chrome.storage.local.set({
      [PROJECTS_KEY]: projects,
      [SETTINGS_KEY]: settings,
      [TASKS_KEY]: result[TASKS_KEY] || [],
      [SESSIONS_KEY]: result[SESSIONS_KEY] || [],
      [DATASETS_KEY]: result[DATASETS_KEY] || {},
      [STORAGE_KEY]: result[STORAGE_KEY] || []
    });
  } catch (error) {
    console.warn("Default state init failed", error);
  }
}

chrome.runtime.onInstalled && chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults();
});

ensureDefaults();

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab?.url) {
    trackUrl(tab.url, tab.id, tab.title).catch((error) => console.warn("Tab track failed", error));
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  finalizeActiveSessionForTab(tabId, new Date().toISOString()).catch((error) => console.warn("Finalize on tab close failed", error));
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  pauseOrResumeForTab(tabId).catch((error) => console.warn("Tab focus update failed", error));
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    pauseActiveSession("window-blur", new Date().toISOString()).catch((error) => console.warn("Window blur pause failed", error));
  } else {
    resumeActiveSession(new Date().toISOString()).catch((error) => console.warn("Window focus resume failed", error));
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  trackUrl(details.url, details.tabId).catch((error) => console.warn("History track failed", error));
}, { url: [{ hostEquals: "avala.ai" }] });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TRACK_CURRENT_URL" && message.url) {
    trackUrl(message.url, message.tabId).then((record) => sendResponse({ ok: true, record }));
    return true;
  }

  if (message?.type === "GET_STATE") {
    loadState().then((state) => sendResponse({ ok: true, state }));
    return true;
  }

  if (message?.type === "SAVE_SETTINGS" && message.settings) {
    saveSettings(message.settings).then((state) => sendResponse({ ok: true, state }));
    return true;
  }

  if (message?.type === "CLEAR_RECORDS") {
    clearAllState().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "GET_PROJECTS") {
    chrome.storage.local.get({ [PROJECTS_KEY]: {} }).then((result) => sendResponse({ ok: true, projects: result[PROJECTS_KEY] || {} }));
    return true;
  }

  if (message?.type === "EXPORT_DATA" && message.format) {
    exportData(message.format).then((blob) => sendResponse({ ok: true, blobUrl: blob?.url || "" }));
    return true;
  }

  if (message?.type === "SET_TASK_COMPLETE" && message.taskId) {
    markTaskComplete(message.taskId, message.completed !== false).then((state) => sendResponse({ ok: true, state }));
    return true;
  }

  if (message?.type === "ADD_NOTE" && message.taskId && message.note !== undefined) {
    addTaskNote(message.taskId, message.note).then((state) => sendResponse({ ok: true, state }));
    return true;
  }

  if (message?.type === "PAGE_METADATA" && message.url) {
    const parsed = AvalaParser.parseAvalaUrl(message.url);
    if (parsed) {
      persistProjectMetadata(parsed, message.title || parsed.title || "Avala Task");
    }
    return false;
  }

  if (message?.type === "MERGE_PROJECTS" && Array.isArray(message.keys) && message.keys.length > 1) {
    mergeProjects(message.keys, message.targetKey).then((state) => sendResponse({ ok: true, state }));
    return true;
  }

  if (message?.type === "DELETE_PROJECT" && message.key) {
    deleteProject(message.key).then((state) => sendResponse({ ok: true, state }));
    return true;
  }

  if (message?.type === "SAVE_PROJECT" && message.key && message.project) {
    saveProject(message.key, message.project).then((state) => sendResponse({ ok: true, state }));
    return true;
  }

  return false;
});

async function loadState() {
  const result = await chrome.storage.local.get({
    [STORAGE_KEY]: [],
    [TASKS_KEY]: [],
    [SESSIONS_KEY]: [],
    [DATASETS_KEY]: {},
    [PROJECTS_KEY]: {},
    [SETTINGS_KEY]: DEFAULT_SETTINGS,
    [ACTIVE_SESSION_KEY]: "",
    [ACTIVE_TASK_KEY]: ""
  });

  const tasks = Array.isArray(result[TASKS_KEY]) ? result[TASKS_KEY] : [];
  const sessions = Array.isArray(result[SESSIONS_KEY]) ? result[SESSIONS_KEY] : [];
  const datasets = result[DATASETS_KEY] || {};
  const projects = result[PROJECTS_KEY] || {};
  const records = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  const settings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  const activeSessionId = result[ACTIVE_SESSION_KEY] || "";
  const activeTaskId = result[ACTIVE_TASK_KEY] || "";

  return { records, tasks, sessions, datasets, projects, settings, activeSessionId, activeTaskId };
}

async function persistState(state) {
  const payload = {
    [STORAGE_KEY]: state.records || [],
    [TASKS_KEY]: state.tasks || [],
    [SESSIONS_KEY]: state.sessions || [],
    [DATASETS_KEY]: state.datasets || {},
    [PROJECTS_KEY]: state.projects || {},
    [SETTINGS_KEY]: state.settings || DEFAULT_SETTINGS,
    [ACTIVE_SESSION_KEY]: state.activeSessionId || "",
    [ACTIVE_TASK_KEY]: state.activeTaskId || ""
  };
  await chrome.storage.local.set(payload);
  return state;
}

async function trackUrl(url, tabId, title) {
  const parsed = AvalaParser.parseAvalaUrl(url);
  if (!parsed) return null;

  const trackedAt = Date.now();
  const lastTrackedAt = recentTracks.get(parsed.id) || 0;
  if (trackedAt - lastTrackedAt < DUPLICATE_WINDOW_MS) return parsed;
  recentTracks.set(parsed.id, trackedAt);

  const now = new Date().toISOString();
  const state = await loadState();
  const taskKey = buildTaskKey(parsed);
  let task = state.tasks.find((entry) => entry.taskKey === taskKey);

  if (!task) {
    task = createTask(parsed, now);
    state.tasks.unshift(task);
  } else {
    task.lastSeenAt = now;
    task.visits = (task.visits || 1) + 1;
    task.projectType = parsed.projectType || task.projectType || "Unknown Project";
    task.dataset = parsed.dataset || task.dataset || "Unknown";
    task.sequenceId = parsed.sequenceId || task.sequenceId || "";
    task.slice = parsed.slice || task.slice || "";
    task.itemId = parsed.itemId || task.itemId || "";
    task.workUnitUid = parsed.workUnitUid || task.workUnitUid || "";
    task.url = parsed.url || task.url || "";
  }

  task.title = task.title || parsed.title || `${parsed.projectType || "Avala"} task`;
  task.completed = Boolean(task.completed);
  task.currentSessionId = state.activeSessionId || task.currentSessionId || "";

  const activeSession = state.sessions.find((entry) => entry.id === state.activeSessionId);
  const sameSession = activeSession && activeSession.taskKey === taskKey && activeSession.status !== "completed";

  if (activeSession && !sameSession) {
    finalizeSession(state, activeSession.id, now);
  }

  if (!sameSession) {
    const session = createSession(parsed, task, now, tabId, title);
    state.sessions.unshift(session);
    state.activeSessionId = session.id;
    task.currentSessionId = session.id;
    task.lastSessionStartedAt = now;
  } else {
    activeSession.lastSeenAt = now;
    activeSession.status = "active";
    activeSession.lastActivityAt = now;
    activeSession.tabId = tabId || activeSession.tabId;
    activeSession.title = title || activeSession.title || parsed.title;
    activeSession.durationMs = Math.max(activeSession.durationMs || 0, calculateDurationMs(activeSession.startTime, now) - (activeSession.pausedMs || 0));
  }

  const record = createRecord(parsed, now);
  state.records = [record].concat(state.records.filter((entry) => entry.id !== record.id));
  const datasetKey = parsed.dataset || parsed.projectType || taskKey;
  state.datasets[datasetKey] = {
    id: datasetKey,
    name: parsed.dataset || datasetKey,
    projectType: parsed.projectType || "Unknown Project",
    tasks: (state.datasets[datasetKey]?.tasks || 0) + 1,
    hours: (state.datasets[datasetKey]?.hours || 0) + 0,
    lastWorkedAt: now,
    firstWorkedAt: state.datasets[datasetKey]?.firstWorkedAt || now
  };

  if (!state.projects[taskKey]) {
    state.projects[taskKey] = {
      id: taskKey,
      title: parsed.title || task.title,
      projectType: parsed.projectType || "Unknown Project",
      dataset: parsed.dataset || "",
      slice: parsed.slice || "",
      itemId: parsed.itemId || "",
      sequenceId: parsed.sequenceId || "",
      workUnitUid: parsed.workUnitUid || "",
      firstSeenAt: now,
      lastSeenAt: now,
      completed: false
    };
  }

  state.activeTaskId = task.id;
  state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  await persistState(state);
  return parsed;
}

function createTask(parsed, now) {
  return {
    id: `${parsed.projectType || "task"}-${parsed.id || `${Date.now()}`}`,
    taskKey: buildTaskKey(parsed),
    projectType: parsed.projectType || "Unknown Project",
    dataset: parsed.dataset || "",
    sequenceId: parsed.sequenceId || "",
    slice: parsed.slice || "",
    itemId: parsed.itemId || "",
    workUnitUid: parsed.workUnitUid || "",
    title: parsed.title || `${parsed.projectType || "Avala"} task`,
    url: parsed.url || "",
    visits: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    completed: false,
    favorite: false,
    tags: [],
    notes: "",
    currentSessionId: ""
  };
}

function createSession(parsed, task, now, tabId, title) {
  return {
    id: `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    taskId: task.id,
    taskKey: task.taskKey,
    projectType: parsed.projectType || task.projectType || "Unknown Project",
    dataset: parsed.dataset || task.dataset || "",
    sequenceId: parsed.sequenceId || task.sequenceId || "",
    slice: parsed.slice || task.slice || "",
    itemId: parsed.itemId || task.itemId || "",
    workUnitUid: parsed.workUnitUid || task.workUnitUid || "",
    title: title || task.title || parsed.title || "Avala Task",
    startTime: now,
    endTime: now,
    durationMs: 0,
    pausedMs: 0,
    status: "active",
    tabId: tabId || 0,
    lastSeenAt: now,
    lastActivityAt: now,
    interruptions: 0,
    tabSwitches: 0,
    completed: false,
    url: parsed.url || task.url || ""
  };
}

function createRecord(parsed, now) {
  return {
    id: parsed.id,
    taskKey: buildTaskKey(parsed),
    projectType: parsed.projectType || "Unknown Project",
    dataset: parsed.dataset || "",
    sequenceId: parsed.sequenceId || "",
    slice: parsed.slice || "",
    itemId: parsed.itemId || "",
    workUnitUid: parsed.workUnitUid || "",
    title: parsed.title || "Avala Task",
    startTime: now,
    endTime: now,
    durationMs: 0,
    visits: 1,
    url: parsed.url || "",
    completed: false,
    firstSeenAt: now,
    lastSeenAt: now
  };
}

function buildTaskKey(parsed) {
  return [parsed.projectType || "Unknown Project", parsed.dataset || "", parsed.sequenceId || parsed.slice || parsed.itemId || parsed.workUnitUid || ""].filter(Boolean).join("|");
}

function finalizeSession(state, sessionId, endTime) {
  const session = state.sessions.find((entry) => entry.id === sessionId);
  if (!session || session.status === "completed") return state;
  const durationMs = Math.max(0, calculateDurationMs(session.startTime, endTime) - (session.pausedMs || 0));
  session.endTime = endTime;
  session.durationMs = durationMs;
  session.completed = true;
  session.status = "completed";
  session.lastSeenAt = endTime;
  const task = state.tasks.find((entry) => entry.id === session.taskId);
  if (task) {
    task.totalDurationMs = (task.totalDurationMs || 0) + durationMs;
    task.lastSeenAt = endTime;
  }
  return state;
}

async function finalizeActiveSessionForTab(tabId, endTime) {
  const state = await loadState();
  const session = state.sessions.find((entry) => entry.tabId === tabId && entry.status !== "completed");
  if (!session) return state;
  finalizeSession(state, session.id, endTime);
  if (state.activeSessionId === session.id) {
    state.activeSessionId = "";
    state.activeTaskId = "";
  }
  await persistState(state);
  return state;
}

async function pauseOrResumeForTab(tabId) {
  const state = await loadState();
  const session = state.sessions.find((entry) => entry.status === "active" && entry.tabId !== tabId);
  if (session) {
    pauseActiveSession("tab-switch", new Date().toISOString(), state);
  }
  const avalaSession = state.sessions.find((entry) => entry.status === "paused" && entry.tabId === tabId);
  if (avalaSession) {
    resumeActiveSession(new Date().toISOString(), state);
  }
  await persistState(state);
  return state;
}

async function pauseActiveSession(reason, now, loadedState) {
  const state = loadedState || await loadState();
  const session = state.sessions.find((entry) => entry.status === "active");
  if (!session) return state;
  session.status = "paused";
  session.pausedMs = (session.pausedMs || 0) + Math.max(0, Date.now() - new Date(session.lastActivityAt || session.startTime).getTime());
  session.lastActivityAt = now;
  session.interruptions = (session.interruptions || 0) + 1;
  session.lastPauseReason = reason;
  await persistState(state);
  return state;
}

async function resumeActiveSession(now, loadedState) {
  const state = loadedState || await loadState();
  const session = state.sessions.find((entry) => entry.status === "paused");
  if (!session) return state;
  session.status = "active";
  session.lastActivityAt = now;
  session.lastResumedAt = now;
  await persistState(state);
  return state;
}

async function saveSettings(settings) {
  const state = await loadState();
  state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}), ...(settings || {}) };
  await persistState(state);
  return state;
}

async function clearAllState() {
  const state = await loadState();
  state.records = [];
  state.tasks = [];
  state.sessions = [];
  state.datasets = {};
  state.activeSessionId = "";
  state.activeTaskId = "";
  await persistState(state);
  return state;
}

async function mergeProjects(keys, targetKey) {
  const state = await loadState();
  const projects = state.projects || {};
  const target = projects[targetKey || keys[0]] || {};
  for (const key of keys) {
    const source = projects[key];
    if (!source || key === (targetKey || keys[0])) continue;
    target.sequences = [...new Set([...(target.sequences || []), ...(source.sequences || [])])];
    target.lastSeenAt = target.lastSeenAt || source.lastSeenAt || new Date().toISOString();
    target.firstSeenAt = target.firstSeenAt || source.firstSeenAt || new Date().toISOString();
    delete projects[key];
  }
  projects[targetKey || keys[0]] = target;
  state.projects = projects;
  await persistState(state);
  return state;
}

async function deleteProject(key) {
  const state = await loadState();
  delete state.projects[key];
  await persistState(state);
  return state;
}

async function saveProject(key, project) {
  const state = await loadState();
  state.projects[key] = project;
  await persistState(state);
  return state;
}

async function persistProjectMetadata(parsed, title) {
  const state = await loadState();
  const taskKey = buildTaskKey(parsed);
  const existing = state.projects[taskKey] || {};
  state.projects[taskKey] = {
    ...existing,
    id: taskKey,
    title: title || existing.title || parsed.title || `${parsed.projectType || "Avala"} task`,
    projectType: parsed.projectType || existing.projectType || "Unknown Project",
    dataset: parsed.dataset || existing.dataset || "",
    slice: parsed.slice || existing.slice || "",
    itemId: parsed.itemId || existing.itemId || "",
    sequenceId: parsed.sequenceId || existing.sequenceId || "",
    workUnitUid: parsed.workUnitUid || existing.workUnitUid || "",
    firstSeenAt: existing.firstSeenAt || parsed.firstSeenAt,
    lastSeenAt: parsed.lastSeenAt || existing.lastSeenAt || new Date().toISOString(),
    url: parsed.url || existing.url || ""
  };
  await persistState(state);
  return state;
}

async function markTaskComplete(taskId, completed) {
  const state = await loadState();
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (task) {
    task.completed = completed;
    task.lastSeenAt = new Date().toISOString();
  }
  await persistState(state);
  return state;
}

async function addTaskNote(taskId, note) {
  const state = await loadState();
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (task) {
    task.notes = note;
    task.lastSeenAt = new Date().toISOString();
  }
  await persistState(state);
  return state;
}

async function exportData(format) {
  const state = await loadState();
  const content = format === "json"
    ? JSON.stringify({ records: state.records, tasks: state.tasks, sessions: state.sessions, datasets: state.datasets, projects: state.projects }, null, 2)
    : format === "csv"
      ? buildCsv(state.records)
      : "";
  const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" });
  return blob;
}

function buildCsv(records) {
  const header = ["projectType", "dataset", "sequenceId", "slice", "itemId", "workUnitUid", "startTime", "endTime", "durationMs", "url"];
  const rows = records.map((record) => header.map((field) => `"${String(record[field] || "").replace(/"/g, '""')}"`).join(","));
  return [header.join(","), ...rows].join("\n");
}

function calculateDurationMs(startTime, endTime) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
}
