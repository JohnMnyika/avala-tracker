const statusText = document.querySelector("#status");
const trackButton = document.querySelector("#trackButton");
const dashboardButton = document.querySelector("#dashboardButton");

trackButton.addEventListener("click", trackCurrentTab);
dashboardButton.addEventListener("click", openDashboard);

async function trackCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const response = await chrome.runtime.sendMessage({ type: "TRACK_CURRENT_URL", url: tab.url });
  statusText.textContent = response?.record
    ? `Tracked ${response.record.dataset} / ${response.record.camera}.`
    : "This tab is not an Avala job link.";
}

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
}
