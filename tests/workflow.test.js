const test = require("node:test");
const assert = require("node:assert/strict");
const workflow = require("../workflow.js");

const row = { "Assignment ID": "20260402104821-0400-v2", Camera: "oak_l_left", Frame: "Frame 39", Annotator: "John Mnyika", Status: "In Progress" };

test("converts spreadsheet rows and creates a stable task id", () => {
  const first = workflow.rowToAssignment(row);
  const reordered = workflow.rowToAssignment({ Status: "In Progress", Annotator: " john   mnyika ", Frame: " frame 39 ", Camera: "OAK_L_LEFT", "Assignment ID": "20260402104821-0400-v2" });
  assert.equal(first.taskId, reordered.taskId);
  assert.equal(first.status, workflow.STATUS_IN_PROGRESS);
});

test("filters only John Mnyika's work", () => {
  assert.equal(workflow.isMine(workflow.rowToAssignment(row), "John Mnyika"), true);
  assert.equal(workflow.isMine(workflow.rowToAssignment({ ...row, Annotator: "Ruth Munene" }), "John Mnyika"), false);
});

test("tracks active and idle time independently", () => {
  const assignment = workflow.rowToAssignment(row);
  const session = workflow.newSession(assignment, "2026-09-12T13:00:00.000Z");
  workflow.accrue(session, "2026-09-12T13:12:00.000Z", 5);
  assert.equal(session.activeMs, 5 * 60 * 1000);
  assert.equal(session.idleMs, 7 * 60 * 1000);
  workflow.closeSession(session, "2026-09-12T13:15:00.000Z", 5);
  assert.equal(session.completed, true);
  assert.equal(session.elapsedMs, 15 * 60 * 1000);
});

test("completed log is deterministic and supports direct completion", () => {
  const assignment = workflow.rowToAssignment({ ...row, Status: "Complete" });
  const session = workflow.newSession(assignment, "2026-09-12T13:00:00.000Z");
  workflow.closeSession(session, "2026-09-12T13:04:00.000Z", 5);
  const log = workflow.completedLog(session, assignment, "2026-09-12T13:04:00.000Z");
  assert.equal(log.task_id, assignment.taskId);
  assert.equal(log.status, "Complete");
  assert.equal(log.active_time, 4 * 60 * 1000);
});
