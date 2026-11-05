import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDispatch } from "../src/dispatch-policy.ts";
import { assertProviderAdmitted } from "../src/providers.ts";
import { assertIngressGated } from "../src/session-ingress.ts";
import { createTask, step, dispatchAllowed, type TaskState } from "../src/task-core.ts";
import { hostNamespace } from "../src/host-namespaces.ts";

test("dispatch-policy uncovered paths", () => {
  // Line 21: read effect
  assert.deepEqual(
    evaluateDispatch({
      actor: "hermes-a",
      effect: "read",
      revision: 1,
      expectedRevision: 1,
      epoch: 2,
      expectedEpoch: 1,
      resourceWriter: "hermes-a",
      actorIsWriter: true,
      commandId: "c",
      alreadyDispatched: false,
    }),
    { allow: true },
  );

  // Line 23: epoch !== expectedEpoch
  assert.deepEqual(
    evaluateDispatch({
      actor: "hermes-a",
      effect: "write",
      revision: 1,
      expectedRevision: 1,
      epoch: 2,
      expectedEpoch: 1,
      resourceWriter: "hermes-a",
      actorIsWriter: true,
      commandId: "c",
      alreadyDispatched: false,
    }),
    { allow: false, reason: "epoch" },
  );

  // Line 25: !actorIsWriter
  assert.deepEqual(
    evaluateDispatch({
      actor: "hermes-a",
      effect: "write",
      revision: 1,
      expectedRevision: 1,
      epoch: 1,
      expectedEpoch: 1,
      resourceWriter: "hermes-b",
      actorIsWriter: false,
      commandId: "c",
      alreadyDispatched: false,
    }),
    { allow: false, reason: "writer" },
  );

  // Line 25: resourceWriter !== actor
  assert.deepEqual(
    evaluateDispatch({
      actor: "hermes-a",
      effect: "write",
      revision: 1,
      expectedRevision: 1,
      epoch: 1,
      expectedEpoch: 1,
      resourceWriter: "hermes-b",
      actorIsWriter: true, // Should still fail if resourceWriter mismatch
      commandId: "c",
      alreadyDispatched: false,
    }),
    { allow: false, reason: "writer" },
  );

  // Line 28: alreadyDispatched
  assert.deepEqual(
    evaluateDispatch({
      actor: "hermes-a",
      effect: "write",
      revision: 1,
      expectedRevision: 1,
      epoch: 1,
      expectedEpoch: 1,
      resourceWriter: "hermes-a",
      actorIsWriter: true,
      commandId: "c",
      alreadyDispatched: true,
    }),
    { allow: false, reason: "duplicate" },
  );

  // Line 28: allow: true
  assert.deepEqual(
    evaluateDispatch({
      actor: "hermes-a",
      effect: "write",
      revision: 1,
      expectedRevision: 1,
      epoch: 1,
      expectedEpoch: 1,
      resourceWriter: "hermes-a",
      actorIsWriter: true,
      commandId: "c",
      alreadyDispatched: false,
    }),
    { allow: true },
  );
});

test("providers uncovered paths", () => {
  // trigger line 52 logic where row is undefined
  assert.throws(() => assertProviderAdmitted("non-existent-provider"), /not admitted/);
});

test("session-ingress uncovered paths", () => {
  // line 315 logic where row is undefined
  assert.throws(() => assertIngressGated("non-existent-type"), /unclassified/);
});

test("host-namespaces uncovered paths", () => {
  // fallback for hostNamespace not found
  const parsed = hostNamespace("non-existent");
  assert.equal(parsed, undefined);
});

test("task-core uncovered paths", () => {
  const base = (): TaskState => createTask({ id: "t1", worktreeId: "w1", driverId: "hermes-a" });

  // line 135 fallback (liveness check with unexpected kind)
  const fakeLiveness = { kind: "unknown" } as unknown;
  // @ts-expect-error test fallback
  const stateWithFake = { ...base(), liveness: fakeLiveness };
  // we just call step to see if livenessMissing does its fallback logic
  const stepRes = step(stateWithFake, { id: "c1", type: "comment", actor: "ted", text: "ping" });
  // since kind='unknown', livenessMissing returns true, so ensureLiveness sets it to blocker
  assert.equal(stepRes.state.liveness.kind, "blocker");

  // lines 469-486 dispatchAllowed
  const state = step(base(), {
    id: "i1",
    type: "instruction",
    actor: "hermes-a",
    role: "driver",
    text: "fix",
  }).state;

  const disState = {
    ...state,
    holdDispatch: false,
    activeCommand: { id: "i1", outcome: "inflight" as const },
  };

  assert.deepEqual(dispatchAllowed(disState as TaskState, "hermes-a", "i1"), {
    allow: false,
    reason: "duplicate",
  });

  assert.deepEqual(dispatchAllowed(disState as TaskState, "ted", "i1"), {
    allow: false,
    reason: "writer",
  });

  assert.deepEqual(dispatchAllowed(disState as TaskState, "hermes-a", "new-id"), { allow: true });

  // test event default fallback
  // using an unknown event type
  const badEvent = { type: "unknown" } as unknown;

  // @ts-expect-error test fallback
  assert.throws(() => step(stateWithFake, badEvent));
});
