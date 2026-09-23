(function attachSpreadsheetWorkflow(root) {
  const STATUS_IN_PROGRESS = "In Progress";
  const STATUS_COMPLETE = "Complete";

  function normalise(value) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ").toLowerCase();
  }

  function display(value) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ");
  }

  function valueFor(row, names) {
    if (!row || typeof row !== "object") return "";
    const index = Object.keys(row).reduce((map, key) => {
      map[normalise(key).replace(/[^a-z0-9]/g, "")] = row[key];
      return map;
    }, {});
    for (const name of names) {
      const value = index[normalise(name).replace(/[^a-z0-9]/g, "")];
      if (value !== undefined && value !== null && String(value).trim()) return display(value);
    }
    return "";
  }

  function canonicalStatus(value) {
    const status = normalise(value);
    if (status === "in progress" || status === "in-progress") return STATUS_IN_PROGRESS;
    if (status === "complete" || status === "completed") return STATUS_COMPLETE;
    return display(value);
  }

  function taskIdFor(assignment) {
    return [assignment.assignmentId, assignment.camera, assignment.frame, assignment.annotator]
      .map((value) => encodeURIComponent(normalise(value) || "unknown"))
      .join("::");
  }

  function rowToAssignment(row, options = {}) {
    const assignmentId = valueFor(row, ["assignment_id", "assignment id", "assignment", "batch", "batch id"]) || display(options.assignmentId);
    const camera = valueFor(row, ["camera", "camera_to_annotate", "camera to annotate"]);
    const frame = valueFor(row, ["frame", "frame number", "frame_id", "frame id"]);
    const annotator = valueFor(row, ["annotator", "annotation owner", "worker"]);
    const assignment = {
      assignmentId,
      camera,
      frame,
      annotator,
      status: canonicalStatus(valueFor(row, ["status", "annotation status"])),
      annotationFeedback: valueFor(row, ["annotation feedback", "feedback"]),
      reviewer: valueFor(row, ["reviewer"]),
      reviewStatus: valueFor(row, ["review status", "review_status"]),
      sourceUpdatedAt: valueFor(row, ["updated_at", "updated at", "last updated"]),
      raw: row
    };
    assignment.taskId = taskIdFor(assignment);
    return assignment;
  }

  function isMine(assignment, annotator) {
    return normalise(assignment?.annotator) === normalise(annotator);
  }

  function newSession(assignment, now) {
    return {
      id: `spreadsheet-${assignment.taskId}-${new Date(now).getTime()}`,
      type: "spreadsheet",
      taskId: assignment.taskId,
      taskKey: assignment.taskId,
      assignmentId: assignment.assignmentId,
      camera: assignment.camera,
      frame: assignment.frame,
      annotator: assignment.annotator,
      title: `${assignment.camera || "Unknown camera"} — ${assignment.frame || "Unknown frame"}`,
      status: "active",
      startTime: now,
      endTime: now,
      lastActivityAt: now,
      activeMs: 0,
      idleMs: 0,
      elapsedMs: 0,
      durationMs: 0,
      completed: false
    };
  }

  function accrue(session, now, idleThresholdMinutes) {
    const end = new Date(now).getTime();
    const previous = new Date(session.lastActivityAt || session.startTime).getTime();
    const elapsed = Math.max(0, end - previous);
    const threshold = Math.max(1, Number(idleThresholdMinutes || 5)) * 60000;
    const active = Math.min(elapsed, threshold);
    const idle = Math.max(0, elapsed - active);
    session.activeMs = Number(session.activeMs || 0) + active;
    session.idleMs = Number(session.idleMs || 0) + idle;
    session.lastActivityAt = now;
    session.elapsedMs = Math.max(0, end - new Date(session.startTime).getTime());
    session.durationMs = session.activeMs;
    return session;
  }

  function activeSnapshot(session, now, idleThresholdMinutes) {
    if (!session || session.status !== "active") return session || null;
    const copy = { ...session };
    return accrue(copy, now, idleThresholdMinutes);
  }

  function closeSession(session, now, idleThresholdMinutes) {
    if (!session || session.completed) return session;
    accrue(session, now, idleThresholdMinutes);
    session.endTime = now;
    session.status = "completed";
    session.completed = true;
    return session;
  }

  function completedLog(session, assignment, now) {
    return {
      id: `worklog-${assignment.taskId}`,
      task_id: assignment.taskId,
      taskId: assignment.taskId,
      assignment_id: assignment.assignmentId,
      assignmentId: assignment.assignmentId,
      camera: assignment.camera,
      frame: assignment.frame,
      annotator: assignment.annotator,
      status: STATUS_COMPLETE,
      started_at: session.startTime,
      completed_at: session.endTime || now,
      elapsed_time: session.elapsedMs || 0,
      active_time: session.activeMs || 0,
      idle_time: session.idleMs || 0,
      date: String(session.endTime || now).slice(0, 10),
      session_id: session.id,
      created_at: now,
      updated_at: now
    };
  }

  function assignmentSummary(assignments, workLog, annotator, now) {
    const mine = assignments.filter((assignment) => isMine(assignment, annotator));
    const completed = mine.filter((assignment) => assignment.status === STATUS_COMPLETE);
    const inProgress = mine.filter((assignment) => assignment.status === STATUS_IN_PROGRESS);
    const completedToday = (workLog || []).filter((entry) => entry.annotator && normalise(entry.annotator) === normalise(annotator) && String(entry.completed_at || "").slice(0, 10) === String(now).slice(0, 10));
    const activeMs = completedToday.reduce((total, entry) => total + Number(entry.active_time || 0), 0);
    return {
      assigned: mine.length,
      inProgress: inProgress.length,
      completed: completed.length,
      remaining: mine.filter((assignment) => assignment.status !== STATUS_COMPLETE).length,
      completedToday: completedToday.length,
      activeMs,
      averageMs: completedToday.length ? activeMs / completedToday.length : 0
    };
  }

  const api = { STATUS_IN_PROGRESS, STATUS_COMPLETE, normalise, canonicalStatus, taskIdFor, rowToAssignment, isMine, newSession, accrue, activeSnapshot, closeSession, completedLog, assignmentSummary };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SpreadsheetWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
