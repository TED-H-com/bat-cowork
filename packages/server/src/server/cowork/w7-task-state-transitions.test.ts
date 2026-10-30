import { expect, test } from "vitest";
import { createTask, step } from "./reducer.js";

test("a task can transition between states via rules", () => {
  let state = createTask({
    id: "task-transition-test",
    driverId: "alice",
    worktreeId: "wt-1",
  });

  expect(state.phase).toBe("active");

  const pauseResult = step(state, {
    id: "e1",
    type: "control",
    action: "pause",
    actor: "alice",
  });
  state = pauseResult.state;
  expect(state.phase).toBe("paused");
  expect(state.holdDispatch).toBe(true);

  const releaseResult = step(state, {
    id: "e2",
    type: "control",
    action: "release",
    actor: "alice",
  });
  state = releaseResult.state;
  expect(state.phase).toBe("active");
  expect(state.holdDispatch).toBe(false);

  const verifyPassResult = step(state, {
    id: "e3",
    type: "verify.passed",
    evidence: { revision: 0, commit: "def456" },
  });
  state = verifyPassResult.state;
  expect(state.phase).toBe("verified");
  expect(state.evidence?.commit).toBe("def456");

  const blockedInstructionResult = step(state, {
    id: "e4",
    type: "instruction",
    actor: "bob",
    role: "driver",
    text: "Bob tries to do something",
  });
  state = blockedInstructionResult.state;
  expect(state.phase).toBe("verified"); // doesn't change
});
