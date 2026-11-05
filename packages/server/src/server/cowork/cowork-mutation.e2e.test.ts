import { describe, expect, test } from "vitest";
import { createDaemonTestContext } from "../test-utils/daemon-test-context.js";
import { mkdtemp } from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("cowork mutations e2e", () => {
  let context: Awaited<ReturnType<typeof createDaemonTestContext>>;

  test("can spawn an agent and send a cowork task list request", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "cowork-e2e-"));
    context = await createDaemonTestContext({
      home: tempDir,
    });

    const client = context.client;

    const agent = await client.createAgent({
      provider: "codex",
      cwd: tempDir,
    });

    expect(agent.id).toBeTruthy();

    const request = {
      type: "cowork.tasks.list.request",
      worktreeId: agent.id,
    } as unknown;

    const responseType = "cowork.tasks.list.response" as unknown;

    const res = await client.sendCorrelatedSessionRequest({
      // @ts-expect-error test payload
      message: request,
      // @ts-expect-error test payload
      responseType,
    });

    expect(res).toBeTruthy();

    await context.cleanup();
  });
});
