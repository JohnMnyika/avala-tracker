importScripts("avalaParser.js");

const STORAGE_KEY = "avalaWorkRecords";
const ACTIVE_TASK_KEY = "avalaActiveTaskId";
const recentTracks = new Map();
const DUPLICATE_WINDOW_MS = 15000;

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    trackUrl(tab.url);
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  trackUrl(details.url);
}, { url: [{ hostEquals: "avala.ai" }] });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TRACK_CURRENT_URL" && message.url) {
    trackUrl(message.url).then((record) => sendResponse({ ok: true, record }));
    return true;
  }

  if (message?.type === "CLEAR_RECORDS") {
    chrome.storage.local.set({ [STORAGE_KEY]: [], [ACTIVE_TASK_KEY]: "" }).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

async function trackUrl(url) {
  const parsed = AvalaParser.parseAvalaUrl(url);
  if (!parsed) return null;

  const trackedAt = Date.now();
  const lastTrackedAt = recentTracks.get(parsed.id) || 0;
  if (trackedAt - lastTrackedAt < DUPLICATE_WINDOW_MS) return parsed;

  recentTracks.set(parsed.id, trackedAt);

  const existingRecords = await getRecords();
  const existingIndex = existingRecords.findIndex((record) => record.id === parsed.id);
  const activeTaskId = await getActiveTaskId();
  const timestamp = parsed.lastSeenAt;

  if (activeTaskId && activeTaskId !== parsed.id) {
    const activeIndex = existingRecords.findIndex((record) => record.id === activeTaskId);
    if (activeIndex >= 0) {
      existingRecords[activeIndex] = finishRecord(existingRecords[activeIndex], timestamp);
    }
  }

  if (existingIndex >= 0) {
    const existing = existingRecords[existingIndex];
    existingRecords[existingIndex] = {
      ...existing,
      ...parsed,
      firstSeenAt: existing.firstSeenAt,
      startTime: existing.startTime || existing.firstSeenAt,
      lastSeenAt: parsed.lastSeenAt,
      endTime: parsed.lastSeenAt,
      durationMs: calculateDurationMs(existing.startTime || existing.firstSeenAt, parsed.lastSeenAt),
      visits: (existing.visits || 1) + 1
    };
  } else {
    existingRecords.unshift({
      ...parsed,
      startTime: parsed.firstSeenAt,
      endTime: parsed.lastSeenAt,
      durationMs: 0
    });
  }

  existingRecords.sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
  await chrome.storage.local.set({
    [STORAGE_KEY]: existingRecords,
    [ACTIVE_TASK_KEY]: parsed.id
  });
  return parsed;
}

async function getRecords() {
  const result = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
}

async function getActiveTaskId() {
  const result = await chrome.storage.local.get({ [ACTIVE_TASK_KEY]: "" });
  return result[ACTIVE_TASK_KEY] || "";
}

function finishRecord(record, endTime) {
  return {
    ...record,
    endTime,
    lastSeenAt: endTime,
    durationMs: calculateDurationMs(record.startTime || record.firstSeenAt, endTime)
  };
}

function calculateDurationMs(startTime, endTime) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
}
