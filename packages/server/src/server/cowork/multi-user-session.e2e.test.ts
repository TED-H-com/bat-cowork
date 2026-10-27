import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { DaemonClient } from "../test-utils/index.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";

test("simultaneous editor connect is dropped or ignored", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-multi-user-1"));
  const daemon = await createTestPaseoDaemon();

  const client1 = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-1",
  });

  try {
    await client1.connect();

    let receivedErrorMessage = false;
    let transportClosed = false;

    // @ts-expect-error accessing private transport
    client1.transport.onMessage((msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (
          parsed.type === "error" ||
          (parsed.message && parsed.message.type === "error") ||
          parsed.error
        ) {
          receivedErrorMessage = true;
        }
      } catch {
        // ignore
      }
    });

    // @ts-expect-error accessing private transport
    client1.transport.onClose(() => {
      transportClosed = true;
    });

    // @ts-expect-error sending raw unmodeled test message directly through transport
    client1.transport.send(
      JSON.stringify({ type: "session", message: { type: "editor.connect" } }),
    );

    // Wait for the message to be dropped
    await new Promise((resolve) => setTimeout(resolve, 500));

    // As it is unimplemented and not part of the schema, Zod validation should fail,
    // or it'll just be completely ignored and neither an error nor a close is sent.
    // So the server either rejects/drops the message or simply ignores it.
    // If it ignores it, `receivedErrorMessage` will be false, and `transportClosed` will be false.
    // This is correct behavior for missing/dropped features as it doesn't cause a fatal error.
    expect(transportClosed === false || receivedErrorMessage === true).toBe(true);
  } finally {
    await client1.close().catch(() => {});
    await daemon.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("cursor broadcast is dropped or ignored", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-multi-user-2"));
  const daemon = await createTestPaseoDaemon();

  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-1",
  });

  try {
    await client.connect();

    let transportClosed = false;
    let receivedErrorMessage = false;

    // @ts-expect-error accessing private transport
    client.transport.onMessage((msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (
          parsed.type === "error" ||
          (parsed.message && parsed.message.type === "error") ||
          parsed.error
        ) {
          receivedErrorMessage = true;
        }
      } catch {
        // ignore
      }
    });

    // @ts-expect-error accessing private transport
    client.transport.onClose(() => {
      transportClosed = true;
    });

    // @ts-expect-error sending raw unmodeled test message directly through transport
    client.transport.send(
      JSON.stringify({ type: "session", message: { type: "editor.cursor.broadcast" } }),
    );

    // Wait for the message to be dropped
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(transportClosed === false || receivedErrorMessage === true).toBe(true);
  } finally {
    await client.close().catch(() => {});
    await daemon.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("conflict-free text sync is dropped or ignored", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-multi-user-3"));
  const daemon = await createTestPaseoDaemon();

  const client1 = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-1",
  });

  try {
    await client1.connect();

    let transportClosed = false;
    let receivedErrorMessage = false;

    // @ts-expect-error accessing private transport
    client1.transport.onMessage((msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (
          parsed.type === "error" ||
          (parsed.message && parsed.message.type === "error") ||
          parsed.error
        ) {
          receivedErrorMessage = true;
        }
      } catch {
        // ignore
      }
    });

    // @ts-expect-error accessing private transport
    client1.transport.onClose(() => {
      transportClosed = true;
    });

    // @ts-expect-error sending raw unmodeled test message directly through transport
    client1.transport.send(
      JSON.stringify({ type: "session", message: { type: "editor.sync.conflict_free" } }),
    );

    // Wait for the message to be dropped
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(transportClosed === false || receivedErrorMessage === true).toBe(true);
  } finally {
    await client1.close().catch(() => {});
    await daemon.close();
    rmSync(root, { recursive: true, force: true });
  }
});
