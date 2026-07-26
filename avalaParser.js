(function attachParser(root) {
  function parseAvalaUrl(rawUrl, now) {
    if (!rawUrl || typeof rawUrl !== "string") return null;

    let url;
    try {
      url = new URL(rawUrl);
    } catch (_error) {
      return null;
    }

    const hostname = (url.hostname || "").toLowerCase();
    if (hostname !== "avala.ai" && !hostname.endsWith(".avala.ai")) return null;

    const params = url.searchParams;
    const capturedAt = now ? new Date(now) : new Date();
    const pathname = url.pathname || "";
    const datasetMatch = pathname.match(/\/datasets\/([^/?#]+)/);
    const sequenceMatch = pathname.match(/\/sequences\/([^/?#]+)/);
    const burroMatch = pathname.match(/\/@burro\/slices\/([^/?#]+)\/items\/([^/?#]+)/);

    const workUnitUid = params.get("work_unit_uid") || params.get("workUnitUid") || "";
    const sequenceId = sequenceMatch ? decodeURIComponent(sequenceMatch[1]) : params.get("sequence_id") || params.get("sequenceId") || "";
    const dataset = datasetMatch ? decodeURIComponent(datasetMatch[1]) : "";

    if (burroMatch) {
      const slice = decodeURIComponent(burroMatch[1]);
      const itemId = decodeURIComponent(burroMatch[2]);
      const projectType = "Burro Segmentation";
      return {
        id: itemId || [projectType, slice].join("|"),
        projectType,
        dataset: "Burro",
        slice,
        itemId,
        sequenceId: "",
        workUnitUid: "",
        url: rawUrl,
        title: `${projectType} · ${slice}`,
        firstSeenAt: capturedAt.toISOString(),
        lastSeenAt: capturedAt.toISOString(),
        visits: 1,
        completed: false
      };
    }

    if (!datasetMatch && !sequenceMatch && !workUnitUid) return null;

    const projectType = "2D Annotation";
    const camera =
      parseCameraFromViewport(params.get("canvas_viewport")) ||
      parseCameraFromLayout(params.get("layout")) ||
      "Unknown";

    return {
      id: workUnitUid || buildRecordId(dataset, sequenceId || "unknown", camera),
      projectType,
      dataset,
      sequenceId,
      workUnitUid,
      camera,
      cuboidTrackingUid: params.get("cuboid_tracking_uid") || "",
      loadRange: params.get("load") || "",
      preview: params.get("preview") || "",
      url: rawUrl,
      title: `${projectType} · ${dataset}`,
      firstSeenAt: capturedAt.toISOString(),
      lastSeenAt: capturedAt.toISOString(),
      visits: 1,
      completed: false
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

  function buildRecordId(dataset, sequenceId, camera) {
    return [dataset, sequenceId, camera].filter(Boolean).join("|");
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
