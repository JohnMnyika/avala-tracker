(function attachParser(root) {
  function parseAvalaUrl(rawUrl, now) {
    if (!rawUrl || typeof rawUrl !== "string") return null;

    let url;
    try {
      url = new URL(rawUrl);
    } catch (_error) {
      return null;
    }

    if (url.hostname !== "avala.ai") return null;

    const datasetMatch = url.pathname.match(/\/datasets\/([^/]+)/);
    const sequenceMatch = url.pathname.match(/\/sequences\/([^/?#]+)/);
    if (!datasetMatch || !sequenceMatch) return null;

    const params = url.searchParams;
    const capturedAt = now ? new Date(now) : new Date();
    const camera =
      parseCameraFromViewport(params.get("canvas_viewport")) ||
      parseCameraFromLayout(params.get("layout")) ||
      "Unknown";

    return {
      id: buildRecordId(url, datasetMatch[1], sequenceMatch[1], camera),
      dataset: decodeURIComponent(datasetMatch[1]),
      sequence: decodeURIComponent(sequenceMatch[1]),
      camera,
      workUnitUid: params.get("work_unit_uid") || "",
      cuboidTrackingUid: params.get("cuboid_tracking_uid") || "",
      loadRange: params.get("load") || "",
      preview: params.get("preview") || "",
      url: rawUrl,
      firstSeenAt: capturedAt.toISOString(),
      lastSeenAt: capturedAt.toISOString(),
      visits: 1
    };
  }

  function parseCameraFromViewport(value) {
    if (!value) return "";
    const decoded = safeDecode(value);
    const match = decoded.match(/^([^:|,\]\[]+)/);
    return match ? match[1].trim() : "";
  }

  function parseCameraFromLayout(value) {
    if (!value) return "";
    const decoded = safeDecode(value);
    const match = decoded.match(/\|([A-Z0-9_ -]{2,})\|/);
    return match ? match[1].trim() : "";
  }

  function buildRecordId(url, dataset, sequence, camera) {
    const workUnitUid = url.searchParams.get("work_unit_uid");
    if (workUnitUid) return workUnitUid;
    return [dataset, sequence, camera].join("|");
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch (_error) {
      return value;
    }
  }

  const api = { parseAvalaUrl };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.AvalaParser = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
