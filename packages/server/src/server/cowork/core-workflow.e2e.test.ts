import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { DaemonClient } from "../test-utils/index.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";
import { syncManagedAgent } from "./mutation-gate.js";
import { forgetJournal, openTask, applyTask, readTask } from "./journal.js";

function ignoreEBUSY(e: unknown) {
  if (e && typeof e === "object" && "code" in e && (e.code === "EBUSY" || e.code === "ENOTEMPTY")) {
    return;
  }
  throw e;
}

test("e2e core workflow: task lifecycle from creation to verification (happy path)", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-e2e-"));
  const repoDir = path.join(root, "repo");
  execFileSync("git", ["init", "-b", "main", repoDir], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@bat-cowork.local"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "BAT Cowork Test"], { cwd: repoDir, stdio: "pipe" });
  writeFileSync(path.join(repoDir, "README.md"), "base\n");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "initial"], { cwd: repoDir, stdio: "pipe" });

  const daemon = await createTestPaseoDaemon();
  const driver = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "d1",
  });

  try {
    await driver.connect();

    // Create Task
    await openTask({
      home: daemon.paseoHome,
      id: "t1",
      driverId: "d1",
      worktreeId: repoDir,
      agentId: "agent-t1",
      cwd: repoDir,
    });

    // Verify task creation
    let task = readTask("t1")?.state;
    expect(task).toBeDefined();
    expect(task?.phase).toBe("active");
    expect(task?.revision).toBe(0);

    // 1. Instruction
    await applyTask("t1", {
      id: "e1",
      type: "instruction",
      actor: "d1",
      role: "driver",
      text: "do work",
    });

    task = readTask("t1")?.state;
    expect(task?.phase).toBe("active");
    expect(task?.revision).toBe(1);

    // Simulate agent process exit
    await applyTask("t1", {
      id: "e2",
      type: "process.exited",
      exitCode: 0,
    });

    // 3. Verify passed
    await applyTask("t1", {
      id: "e3",
      type: "verify.passed",
      evidence: { revision: 1, commit: "commit1" },
    });

    task = readTask("t1")?.state;
    expect(task?.phase).toBe("verified");

  } finally {
    syncManagedAgent("agent-t1", null);
    await forgetJournal();
    await driver.close().catch(() => undefined);
    await daemon.close();
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (e: unknown) {
      ignoreEBUSY(e);
    }
  }
}, 180000);

test("e2e core workflow: rework (verify failed, then verify passed)", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-e2e-rw-"));
  const repoDir = path.join(root, "repo");
  execFileSync("git", ["init", "-b", "main", repoDir], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@bat-cowork.local"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "BAT Cowork Test"], { cwd: repoDir, stdio: "pipe" });
  writeFileSync(path.join(repoDir, "README.md"), "base\n");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "initial"], { cwd: repoDir, stdio: "pipe" });

  const daemon = await createTestPaseoDaemon();
  const driver = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "d1",
  });

  try {
    await driver.connect();

    // Create Task
    await openTask({
      home: daemon.paseoHome,
      id: "t2",
      driverId: "d1",
      worktreeId: repoDir,
      agentId: "agent-t2",
      cwd: repoDir,
    });

    // 1. Instruction
    await applyTask("t2", {
      id: "e1",
      type: "instruction",
      actor: "d1",
      role: "driver",
      text: "do work",
    });

    let task = readTask("t2")?.state;
    expect(task?.phase).toBe("active");
    expect(task?.revision).toBe(1);

    // Verify failed
    await applyTask("t2", {
      id: "e2",
      type: "verify.failed",
    });

    task = readTask("t2")?.state;
    expect(task?.phase).toBe("active");
    expect(task?.reworkAttempts).toBe(1);
    expect(task?.activeCommand).toBeDefined();
    expect(task?.activeCommand?.id).toBe("repair:e2");

    // Verify passed
    await applyTask("t2", {
      id: "e3",
      type: "verify.passed",
      evidence: { revision: 1, commit: "commit2" },
    });

    task = readTask("t2")?.state;
    expect(task?.phase).toBe("verified");

  } finally {
    syncManagedAgent("agent-t2", null);
    await forgetJournal();
    await driver.close().catch(() => undefined);
    await daemon.close();
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (e: unknown) {
      ignoreEBUSY(e);
    }
  }
}, 180000);

test("e2e core workflow: takeover by another user", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-e2e-to-"));
  const repoDir = path.join(root, "repo");
  execFileSync("git", ["init", "-b", "main", repoDir], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@bat-cowork.local"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "BAT Cowork Test"], { cwd: repoDir, stdio: "pipe" });
  writeFileSync(path.join(repoDir, "README.md"), "base\n");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "initial"], { cwd: repoDir, stdio: "pipe" });

  const daemon = await createTestPaseoDaemon();
  const driver1 = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "d1",
  });

  const driver2 = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "d2",
  });

  try {
    await driver1.connect();
    await driver2.connect();

    // Create Task
    await openTask({
      home: daemon.paseoHome,
      id: "t3",
      driverId: "d1",
      worktreeId: repoDir,
      agentId: "agent-t3",
      cwd: repoDir,
    });

    // Takeover by d2
    await applyTask("t3", {
      id: "e1",
      type: "control",
      action: "takeover",
      actor: "d2",
    });

    let task = readTask("t3")?.state;
    expect(task?.controlEpoch).toBe(2);
    expect(task?.holdDispatch).toBe(true);

    // Settle
    await applyTask("t3", {
      id: "e2",
      type: "writer.settled",
      epoch: 2,
    });

    // Release
    await applyTask("t3", {
      id: "e3",
      type: "control",
      action: "release",
      actor: "d2",
    });

    task = readTask("t3")?.state;
    expect(task?.holdDispatch).toBe(false);

  } finally {
    syncManagedAgent("agent-t3", null);
    await forgetJournal();
    await driver1.close().catch(() => undefined);
    await driver2.close().catch(() => undefined);
    await daemon.close();
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (e: unknown) {
      ignoreEBUSY(e);
    }
  }
}, 180000);

test("e2e core workflow: pause and cancel", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-e2e-pc-"));
  const repoDir = path.join(root, "repo");
  execFileSync("git", ["init", "-b", "main", repoDir], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@bat-cowork.local"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "BAT Cowork Test"], { cwd: repoDir, stdio: "pipe" });
  writeFileSync(path.join(repoDir, "README.md"), "base\n");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "initial"], { cwd: repoDir, stdio: "pipe" });

  const daemon = await createTestPaseoDaemon();
  const driver = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "d1",
  });

  try {
    await driver.connect();

    // Create Task
    await openTask({
      home: daemon.paseoHome,
      id: "t4",
      driverId: "d1",
      worktreeId: repoDir,
      agentId: "agent-t4",
      cwd: repoDir,
    });

    // Pause
    await applyTask("t4", {
      id: "e1",
      type: "control",
      action: "pause",
      actor: "d1",
    });

    let task = readTask("t4")?.state;
    expect(task?.phase).toBe("paused");
    expect(task?.holdDispatch).toBe(true);

    // Cancel
    await applyTask("t4", {
      id: "e2",
      type: "control",
      action: "cancel",
      actor: "d1",
    });

    task = readTask("t4")?.state;
    expect(task?.phase).toBe("cancelled");
    expect(task?.holdDispatch).toBe(true);

  } finally {
    syncManagedAgent("agent-t4", null);
    await forgetJournal();
    await driver.close().catch(() => undefined);
    await daemon.close();
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (e: unknown) {
      ignoreEBUSY(e);
    }
  }
}, 180000);
