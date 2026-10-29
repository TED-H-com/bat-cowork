import { test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDaemonTestContext, type DaemonTestContext } from "../test-utils/index.js";
import { DaemonClient } from "../test-utils/index.js";

function tmpCwd(): string {
  return mkdtempSync(path.join(tmpdir(), "worker-lock-e2e-"));
}

let ctx: DaemonTestContext;

beforeEach(async () => {
  ctx = await createDaemonTestContext();
});

afterEach(async () => {
  await ctx.cleanup();
}, 30000);

test("distributed worker lock handling isolates parallel access", async () => {
  const cwd = tmpCwd();

  const client1 = ctx.client;
  const client2 = new DaemonClient({ url: `ws://127.0.0.1:${ctx.daemon.port}/ws` });

  await client2.connect();

  const agent1 = await client1.createAgent({
    provider: "claude",
    model: "haiku",
    cwd,
    title: "Worker Lock Agent",
    modeId: "bypassPermissions",
  });

  const m1 = client1.sendMessage(agent1.id, "run task 1");
  const m2 = client2.sendMessage(agent1.id, "run task 2");

  await Promise.allSettled([m1, m2]);

  const state = await client1.waitForFinish(agent1.id, 10000);
  expect(state.status).toBe("idle");

  await client1.deleteAgent(agent1.id);
  await client2.close();
  rmSync(cwd, { recursive: true, force: true });
}, 45000);
