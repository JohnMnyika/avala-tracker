// Runs on Avala pages. Avala's address bar URL is not necessarily the task URL,
// so the navigation control's copied view link is the canonical source of truth.
(function () {
  const DEBUG = false; // Set to true while diagnosing Avala UI changes during development.
  const COPY_LABEL = /\bcopy\s+(?:(?:the\s+)?link(?:\s+to\s+(?:this\s+)?view)?|view\s+link)\b/i;
  const COPY_CANDIDATE_SELECTOR = [
    "button", "a", "[role='button']", "[role='menuitem']", "[role='option']", "[tabindex]",
    "[aria-label]", "[title]", "[data-copy-link]", "[data-copy-url]"
  ].join(",");
  const COPY_URL_ATTRIBUTES = ["href", "data-copy-link", "data-copy-url", "data-url", "data-link", "data-value"];
  const attemptedControls = new WeakSet();
  let lastDetectedUrl = "";
  let detectionTimer = 0;
  let forceDetectionPending = false;

  function debug(...args) {
    if (DEBUG) console.log("[Avala Tracker]", ...args);
  }

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(element) {
    return Boolean(element && element.isConnected && element.getClientRects().length && element.getAttribute("aria-hidden") !== "true");
  }

  function accessibleText(element) {
    const labelledBy = (element.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || "")
      .join(" ");
    return normalise([
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      labelledBy,
      element.innerText,
      element.textContent
    ].filter(Boolean).join(" "));
  }

  function findCopyViewControl() {
    debug("Searching for Copy link to this view");
    for (const element of document.querySelectorAll(COPY_CANDIDATE_SELECTOR)) {
      if (isVisible(element) && COPY_LABEL.test(accessibleText(element))) {
        debug("View link control found");
        return element;
      }
    }
    return null;
  }

  function isValidAvalaViewUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      const host = url.hostname.toLowerCase();
      return url.protocol === "https:" && (host === "avala.ai" || host.endsWith(".avala.ai"));
    } catch (_error) {
      return false;
    }
  }

  function urlFromValue(value) {
    const text = String(value || "").trim();
    if (isValidAvalaViewUrl(text)) return text;
    const match = text.match(/https:\/\/[^\s"'<>]+/i);
    return match && isValidAvalaViewUrl(match[0]) ? match[0] : "";
  }

  function urlFromControlAttributes(control) {
    const relatedAnchor = control.closest("a[href]");
    for (const element of [control, relatedAnchor].filter(Boolean)) {
      for (const attribute of COPY_URL_ATTRIBUTES) {
        const url = urlFromValue(element.getAttribute(attribute));
        if (url) return url;
      }
    }
    return "";
  }

  function currentWorkUnitUrlFallback() {
    // Avala's Flutter canvas can render its toolbar without a DOM/semantics
    // representation. In that case, only accept the address bar when it is a
    // concrete work-unit URL, never as a generic project/view URL.
    try {
      const url = new URL(location.href);
      return isValidAvalaViewUrl(url.href) && /^\/wu\/[^/?#]+$/.test(url.pathname) ? url.href : "";
    } catch (_error) {
      return "";
    }
  }

  async function readClipboardUrl() {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== "function") return "";
    try {
      return urlFromValue(await navigator.clipboard.readText());
    } catch (error) {
      debug("Clipboard read unavailable", error?.name || error);
      return "";
    }
  }

  async function activateAndReadCopyControl(control) {
    let copiedByEvent = "";
    const onCopy = (event) => {
      copiedByEvent = urlFromValue(event.clipboardData?.getData("text/plain"));
    };

    // Capture DOM copy events without writing to the user's clipboard ourselves.
    document.addEventListener("copy", onCopy, true);
    try {
      control.click();
      for (const delay of [0, 100, 250, 500]) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        if (copiedByEvent) return copiedByEvent;
        const clipboardUrl = await readClipboardUrl();
        if (clipboardUrl) return clipboardUrl;
      }
      return copiedByEvent;
    } finally {
      document.removeEventListener("copy", onCopy, true);
    }
  }

  async function getCurrentAvalaViewUrl(options = {}) {
    const control = findCopyViewControl();
    if (!control) {
      const fallbackUrl = currentWorkUnitUrlFallback();
      if (fallbackUrl) {
        debug("Copy-link control is inaccessible; using the current work-unit URL fallback", fallbackUrl);
        return { url: fallbackUrl, status: "detected" };
      }
      debug("Could not find an accessible Copy link to this view control");
      return { url: "", status: "not-found" };
    }

    const attributeUrl = urlFromControlAttributes(control);
    if (attributeUrl) return { url: attributeUrl, status: "detected" };
    if (!options.force && attemptedControls.has(control)) {
      return { url: lastDetectedUrl, status: lastDetectedUrl ? "detected" : "clipboard-error" };
    }
    attemptedControls.add(control);

    const url = await activateAndReadCopyControl(control);
    if (!url) return { url: "", status: "clipboard-error" };
    debug("Retrieved view URL:", url);
    return { url, status: "detected" };
  }

  function pageMetadata() {
    const documentTitle = normalise(document.title);
    const batchMatch = documentTitle.match(/(?:^|[·|])\s*([^·|]*\bbatch-[a-z0-9][a-z0-9-]*)\s*$/i);
    const title = documentTitle || normalise(
      document.querySelector("[data-test='project-title'], .project-title, .slice-title, h1")?.innerText
    );
    const datasetEl = document.querySelector("[data-dataset], .dataset");
    return {
      title,
      dataset: normalise(datasetEl?.getAttribute("data-dataset") || datasetEl?.innerText) || batchMatch?.[1]?.trim() || ""
    };
  }

  async function detectAndReport(options = {}) {
    const result = await getCurrentAvalaViewUrl(options);
    if (result.url) {
      lastDetectedUrl = result.url;
      await chrome.runtime.sendMessage({ type: "CANONICAL_VIEW_URL", url: result.url, ...pageMetadata() });
    }
    return result;
  }

  function scheduleDetection(force = false) {
    forceDetectionPending = forceDetectionPending || force;
    clearTimeout(detectionTimer);
    detectionTimer = setTimeout(() => {
      const shouldForce = forceDetectionPending;
      forceDetectionPending = false;
      detectAndReport({ force: shouldForce }).catch((error) => debug("View URL detection failed", error));
    }, forceDetectionPending ? 700 : 250);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_CURRENT_AVALA_VIEW_URL") {
      detectAndReport({ force: true }).then(sendResponse, () => sendResponse({ url: "", status: "clipboard-error" }));
      return true;
    }
    if (message?.type === "AVALA_ROUTE_CHANGED") scheduleDetection(true);
    return false;
  });

  const observer = new MutationObserver(() => scheduleDetection(false));
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "title", "href"] });
  window.addEventListener("popstate", () => scheduleDetection(true));
  window.addEventListener("hashchange", () => scheduleDetection(true));
  let activityTimer = 0;
  const reportActivity = () => {
    const now = Date.now();
    if (now - activityTimer < 30000) return;
    activityTimer = now;
    chrome.runtime.sendMessage({ type: "ACTIVITY_PING" }).catch(() => {});
  };
  for (const eventName of ["pointerdown", "keydown", "wheel", "touchstart"]) window.addEventListener(eventName, reportActivity, { passive: true });
  scheduleDetection(true);
})();
