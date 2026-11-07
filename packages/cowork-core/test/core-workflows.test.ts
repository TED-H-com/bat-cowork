import assert from "node:assert/strict";
import test from "node:test";
import { createTask, step } from "../src/task-core.ts";

test("e2e core workflow: task lifecycle from creation to verification (happy path)", () => {
  let state = createTask({ id: "t1", worktreeId: "w1", driverId: "d1" });

  // 1. Instruction
  state = step(state, {
    id: "e1",
    type: "instruction",
    actor: "d1",
    role: "driver",
    text: "do work",
  }).state;
  assert.equal(state.phase, "active");
  assert.equal(state.revision, 1);

  // 2. Process exited
  state = step(state, {
    id: "e2",
    type: "process.exited",
    exitCode: 0,
  }).state;

  // 3. Verify passed
  state = step(state, {
    id: "e3",
    type: "verify.passed",
    evidence: { revision: 1, commit: "commit1" },
  }).state;
  assert.equal(state.phase, "verified");
});

test("e2e core workflow: rework (verify failed, then verify passed)", () => {
  let state = createTask({ id: "t2", worktreeId: "w2", driverId: "d1" });

  state = step(state, {
    id: "e1",
    type: "instruction",
    actor: "d1",
    role: "driver",
    text: "do work",
  }).state;
  assert.equal(state.phase, "active");
  assert.equal(state.revision, 1);

  // Verify failed
  state = step(state, {
    id: "e2",
    type: "verify.failed",
  }).state;
  assert.equal(state.phase, "active");
  assert.equal(state.reworkAttempts, 1);
  assert.ok(state.activeCommand);
  assert.equal(state.activeCommand.id, "repair:e2");

  // Verify passed
  state = step(state, {
    id: "e3",
    type: "verify.passed",
    evidence: { revision: 1, commit: "commit2" },
  }).state;
  assert.equal(state.phase, "verified");
});

test("e2e core workflow: takeover by another user", () => {
  let state = createTask({ id: "t3", worktreeId: "w3", driverId: "d1" });

  // Takeover by d2
  state = step(state, {
    id: "e1",
    type: "control",
    action: "takeover",
    actor: "d2",
  }).state;
  assert.equal(state.controlEpoch, 2);
  assert.equal(state.holdDispatch, true);

  // Settle
  state = step(state, {
    id: "e2",
    type: "writer.settled",
    epoch: 2,
  }).state;

  // Release
  state = step(state, {
    id: "e3",
    type: "control",
    action: "release",
    actor: "d2",
  }).state;
  assert.equal(state.holdDispatch, false);
});

test("e2e core workflow: pause and cancel", () => {
  let state = createTask({ id: "t4", worktreeId: "w4", driverId: "d1" });

  // Pause
  state = step(state, {
    id: "e1",
    type: "control",
    action: "pause",
    actor: "d1",
  }).state;
  assert.equal(state.phase, "paused");
  assert.equal(state.holdDispatch, true);

  // Cancel
  state = step(state, {
    id: "e2",
    type: "control",
    action: "cancel",
    actor: "d1",
  }).state;
  assert.equal(state.phase, "cancelled");
  assert.equal(state.holdDispatch, true);
});
