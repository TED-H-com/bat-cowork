import test from "node:test";
import assert from "node:assert";
import { createTask, step, type TaskEvent } from "../src/task-core.ts";

test("benchmark: step performance with many events", () => {
  const start = performance.now();

  let state = createTask({
    id: "bench-task-1",
    driverId: "bench-driver",
    worktreeId: "wt-bench",
  });

  const eventCount = 10000;

  for (let i = 0; i < eventCount; i++) {
    const event: TaskEvent = {
      id: `evt-${i}`,
      type: "comment",
      actor: "bench-driver",
      text: `comment number ${i}`,
    };
    state = step(state, event).state;
  }

  const end = performance.now();
  const duration = end - start;

  console.log(`Benchmark: ${eventCount} events processed in ${duration.toFixed(2)}ms`);

  // We just want to ensure it doesn't take an absurd amount of time
  // For 10000 events, it should be well under 1000ms after optimizations
  assert.ok(duration < 1000, `Performance regression: ${eventCount} events took ${duration}ms`);
});
