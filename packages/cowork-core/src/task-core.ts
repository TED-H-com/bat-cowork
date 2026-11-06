// In-memory task reducer. No sockets, no clock, no provider calls.

import { evaluateDispatch, type DispatchDecision } from "./dispatch-policy.ts";

export type Phase = "active" | "paused" | "verified" | "cancelled" | "rejected";

export type Liveness =
  | { kind: "command"; commandId: string }
  | { kind: "wake"; nextWakeAt: string }
  | { kind: "blocker"; owner: string; reason: string };

export interface TimelineEntry {
  eventId: string;
  kind: string;
  actor: string;
  text: string;
}

export interface Evidence {
  revision: number;
  commit: string;
}

export interface OutboxItem {
  id: string;
  kind: "verified";
  failed: boolean;
}

export interface TaskState {
  id: string;
  phase: Phase;
  revision: number;
  driverId: string;
  controlEpoch: number;
  writerId: string | null;
  writerSettledEpoch: number | null;
  holdDispatch: boolean;
  worktreeId: string;
  appliedEventIds: readonly string[];
  timeline: readonly TimelineEntry[];
  activeCommand: { id: string; outcome: "inflight" | "unknown" } | null;
  pendingInput: { revision: number; text: string } | null;
  evidence: Evidence | null;
  reworkAttempts: number;
  maxRework: number;
  outbox: readonly OutboxItem[];
  liveness: Liveness;
}

export type TaskEvent =
  | { id: string; type: "comment"; actor: string; text: string }
  | { id: string; type: "proposal"; actor: string; text: string }
  | { id: string; type: "instruction"; actor: string; role: "driver" | "viewer"; text: string }
  | {
      id: string;
      type: "control";
      action: "pause" | "takeover" | "cancel" | "release";
      actor: string;
    }
  | { id: string; type: "presence"; actor: string }
  | { id: string; type: "lease.expired" }
  | { id: string; type: "writer.settled"; epoch: number }
  | { id: string; type: "command.unknown"; commandId: string }
  | { id: string; type: "assistant.finished"; text: string }
  | { id: string; type: "stream.ended" }
  | { id: string; type: "process.exited"; exitCode: number }
  | { id: string; type: "verify.failed" }
  | { id: string; type: "verify.passed"; evidence: Evidence }
  | { id: string; type: "notify.failed"; outboxId: string };

export type Intent =
  | { type: "dispatch"; commandId: string; revision: number }
  | { type: "repair"; commandId: string; revision: number }
  | { type: "notify"; outboxId: string };

export interface StepResult {
  state: TaskState;
  intents: readonly Intent[];
}

const TERMINAL: ReadonlySet<Phase> = new Set(["verified", "cancelled", "rejected"]);

export function createTask(input: {
  id: string;
  driverId: string;
  worktreeId: string;
  maxRework?: number;
}): TaskState {
  return {
    id: input.id,
    phase: "active",
    revision: 0,
    driverId: input.driverId,
    controlEpoch: 1,
    writerId: input.driverId,
    writerSettledEpoch: null,
    holdDispatch: false,
    worktreeId: input.worktreeId,
    appliedEventIds: [],
    timeline: [],
    activeCommand: null,
    pendingInput: null,
    evidence: null,
    reworkAttempts: 0,
    maxRework: input.maxRework ?? 2,
    outbox: [],
    liveness: { kind: "blocker", owner: "unassigned", reason: "no-instruction" },
  };
}

function note(
  state: TaskState,
  eventId: string,
  kind: string,
  actor: string,
  text: string,
): TaskState {
  const timeline = state.timeline.slice();
  timeline.push({ eventId, kind, actor, text });
  return {
    ...state,
    timeline,
  };
}

function withLiveness(state: TaskState, liveness: Liveness): TaskState {
  return { ...state, liveness };
}

function livenessMissing(state: TaskState): boolean {
  const slot = state.liveness as Liveness | undefined;
  if (!slot) return true;
  if (slot.kind === "command") return slot.commandId.length === 0;
  if (slot.kind === "wake") return slot.nextWakeAt.length === 0;
  if (slot.kind === "blocker") return slot.owner.length === 0;
  return true;
}

function ensureLiveness(state: TaskState): TaskState {
  if (TERMINAL.has(state.phase)) return state;
  if (!livenessMissing(state)) return state;
  return withLiveness(state, { kind: "blocker", owner: "unassigned", reason: "missing-liveness" });
}

function commandIdFor(eventId: string): string {
  return `cmd:${eventId}`;
}

export function step(state: TaskState, event: TaskEvent): StepResult {
  if (state.appliedEventIds.includes(event.id)) {
    return { state, intents: [] };
  }
  const appliedEventIds = state.appliedEventIds.slice();
  appliedEventIds.push(event.id);
  const seen: TaskState = {
    ...state,
    appliedEventIds,
  };
  const result = reduce(seen, event);
  return { state: ensureLiveness(result.state), intents: result.intents };
}

function reduce(state: TaskState, event: TaskEvent): StepResult {
  switch (event.type) {
    case "comment":
    case "proposal":
      return { state: note(state, event.id, event.type, event.actor, event.text), intents: [] };
    case "presence":
      return { state: note(state, event.id, "presence", event.actor, ""), intents: [] };
    case "lease.expired":
      return {
        state: note(state, event.id, "lease.expired", "system", "lease expired; writer kept"),
        intents: [],
      };
    case "instruction":
      return instruct(state, event);
    case "control":
      return control(state, event);
    case "writer.settled":
      if (event.epoch !== state.controlEpoch) return { state, intents: [] };
      return {
        state: note(
          { ...state, writerSettledEpoch: event.epoch },
          event.id,
          "writer.settled",
          "system",
          `epoch ${event.epoch}`,
        ),
        intents: [],
      };
    case "command.unknown":
      if (state.activeCommand?.id !== event.commandId) return { state, intents: [] };
      return {
        state: withLiveness(
          note(
            {
              ...state,
              holdDispatch: true,
              activeCommand: { id: event.commandId, outcome: "unknown" },
            },
            event.id,
            "command.unknown",
            "system",
            event.commandId,
          ),
          { kind: "blocker", owner: "unassigned", reason: "command-unknown" },
        ),
        intents: [],
      };
    case "assistant.finished":
    case "stream.ended":
    case "process.exited":
      return {
        state: note(
          state,
          event.id,
          event.type,
          "runtime",
          event.type === "assistant.finished" ? event.text : event.type,
        ),
        intents: [],
      };
    case "verify.failed":
      return failVerify(state, event.id);
    case "verify.passed":
      return passVerify(state, event);
    case "notify.failed":
      return {
        state: {
          ...state,
          outbox: state.outbox.map((item) =>
            item.id === event.outboxId ? { ...item, failed: true } : item,
          ),
        },
        intents: [],
      };
    default: {
      const _never: never = event;
      return _never;
    }
  }
}

function instruct(
  state: TaskState,
  event: Extract<TaskEvent, { type: "instruction" }>,
): StepResult {
  const sealed = state.phase === "cancelled" || state.phase === "rejected";
  const allowed = event.role === "driver" && event.actor === state.driverId && !sealed;
  if (!allowed) {
    return {
      state: note(state, event.id, "instruction.rejected", event.actor, event.text),
      intents: [],
    };
  }
  const revision = state.revision + 1;
  const commandId = commandIdFor(event.id);
  const next: TaskState = {
    ...note(state, event.id, "instruction", event.actor, event.text),
    phase: state.phase === "verified" ? "active" : state.phase,
    revision,
    pendingInput: { revision, text: event.text },
    reworkAttempts: 0,
    activeCommand: state.holdDispatch
      ? state.activeCommand
      : { id: commandId, outcome: "inflight" },
  };
  if (state.holdDispatch) {
    return {
      state: withLiveness(next, {
        kind: "blocker",
        owner: state.driverId,
        reason: "dispatch-held",
      }),
      intents: [],
    };
  }
  return {
    state: withLiveness(next, { kind: "command", commandId }),
    intents: [{ type: "dispatch", commandId, revision }],
  };
}

function control(state: TaskState, event: Extract<TaskEvent, { type: "control" }>): StepResult {
  if (event.action === "pause" || event.action === "cancel") {
    if (event.actor !== state.driverId) {
      return {
        state: note(state, event.id, "control.rejected", event.actor, event.action),
        intents: [],
      };
    }
  }
  if (event.action === "pause") {
    return {
      state: withLiveness(
        note({ ...state, phase: "paused", holdDispatch: true }, event.id, "pause", event.actor, ""),
        { kind: "blocker", owner: event.actor, reason: "paused" },
      ),
      intents: [],
    };
  }
  if (event.action === "cancel") {
    return {
      state: note(
        { ...state, phase: "cancelled", holdDispatch: true, activeCommand: null },
        event.id,
        "cancel",
        event.actor,
        "",
      ),
      intents: [],
    };
  }
  if (event.action === "takeover") {
    const controlEpoch = state.controlEpoch + 1;
    return {
      state: withLiveness(
        note(
          { ...state, controlEpoch, holdDispatch: true, writerSettledEpoch: null },
          event.id,
          "takeover",
          event.actor,
          `epoch ${controlEpoch}`,
        ),
        { kind: "blocker", owner: event.actor, reason: "await-writer-settle" },
      ),
      intents: [],
    };
  }
  if (state.phase === "paused") {
    if (event.actor !== state.driverId) {
      return {
        state: note(state, event.id, "release.rejected", event.actor, "not the driver"),
        intents: [],
      };
    }
    return {
      state: withLiveness(
        note(
          { ...state, holdDispatch: false, phase: "active" },
          event.id,
          "release",
          event.actor,
          "",
        ),
        { kind: "wake", nextWakeAt: "after-release" },
      ),
      intents: [],
    };
  }
  if (state.activeCommand?.outcome === "unknown") {
    if (event.actor !== state.driverId) {
      return {
        state: note(state, event.id, "release.rejected", event.actor, "not the driver"),
        intents: [],
      };
    }
    return {
      state: withLiveness(
        note(
          { ...state, holdDispatch: false },
          event.id,
          "release",
          event.actor,
          "unknown command acknowledged",
        ),
        { kind: "wake", nextWakeAt: "after-release" },
      ),
      intents: [],
    };
  }
  const settled = state.writerSettledEpoch === state.controlEpoch;
  if (!settled) {
    return {
      state: note(state, event.id, "release.rejected", event.actor, "writer not settled"),
      intents: [],
    };
  }
  return {
    state: withLiveness(
      note(
        {
          ...state,
          holdDispatch: false,
          phase: state.phase === "paused" ? "active" : state.phase,
          writerId: state.driverId,
        },
        event.id,
        "release",
        event.actor,
        "",
      ),
      { kind: "wake", nextWakeAt: "after-release" },
    ),
    intents: [],
  };
}

function failVerify(state: TaskState, eventId: string): StepResult {
  if (TERMINAL.has(state.phase)) return { state, intents: [] };
  if (state.reworkAttempts >= state.maxRework) {
    return {
      state: withLiveness(note(state, eventId, "verify.failed", "verifier", "rework cap"), {
        kind: "blocker",
        owner: "unassigned",
        reason: "rework-cap",
      }),
      intents: [],
    };
  }
  const reworkAttempts = state.reworkAttempts + 1;
  const commandId = `repair:${eventId}`;
  return {
    state: withLiveness(
      note(
        { ...state, reworkAttempts, activeCommand: { id: commandId, outcome: "inflight" } },
        eventId,
        "verify.failed",
        "verifier",
        `attempt ${reworkAttempts}`,
      ),
      { kind: "command", commandId },
    ),
    intents: [{ type: "repair", commandId, revision: state.revision }],
  };
}

function passVerify(
  state: TaskState,
  event: Extract<TaskEvent, { type: "verify.passed" }>,
): StepResult {
  const sameCommit = state.evidence?.commit === event.evidence.commit;
  const matches =
    event.evidence.revision === state.revision && event.evidence.commit.length > 0 && !sameCommit;
  const unknown = state.activeCommand?.outcome === "unknown";
  if (!matches || unknown || state.holdDispatch || TERMINAL.has(state.phase)) {
    return {
      state: note(state, event.id, "verify.rejected", "verifier", "evidence does not close"),
      intents: [],
    };
  }
  const outboxId = `out:${event.id}`;
  const outbox = state.outbox.slice();
  outbox.push({ id: outboxId, kind: "verified", failed: false });
  return {
    state: note(
      {
        ...state,
        phase: "verified",
        evidence: event.evidence,
        activeCommand: null,
        outbox,
      },
      event.id,
      "verify.passed",
      "verifier",
      event.evidence.commit,
    ),
    intents: [{ type: "notify", outboxId }],
  };
}

export function claimWriter(
  claims: Readonly<Record<string, string>>,
  worktreeId: string,
  taskId: string,
): { ok: true; claims: Record<string, string> } | { ok: false; holder: string } {
  const holder = claims[worktreeId];
  if (holder !== undefined && holder !== taskId) return { ok: false, holder };
  return { ok: true, claims: { ...claims, [worktreeId]: taskId } };
}

export function dispatchAllowed(
  state: TaskState,
  actor: string,
  commandId: string,
): DispatchDecision {
  return evaluateDispatch({
    actor,
    effect: "write",
    revision: state.revision,
    expectedRevision: state.revision,
    epoch: state.controlEpoch,
    expectedEpoch: state.controlEpoch,
    resourceWriter: state.writerId,
    actorIsWriter: actor === state.writerId && !state.holdDispatch,
    commandId,
    alreadyDispatched:
      state.activeCommand?.id === commandId && state.activeCommand.outcome === "inflight",
  });
}

export function managedWriteFields(state: TaskState): {
  writerId: string;
  revision: number;
  expectedRevision: number;
  epoch: number;
  expectedEpoch: number;
  holdDispatch: boolean;
} | null {
  if (state.writerId === null) return null;
  if (state.phase === "verified" || state.phase === "cancelled" || state.phase === "rejected") {
    return null;
  }
  return {
    writerId: state.writerId,
    revision: state.revision,
    expectedRevision: state.revision,
    epoch: state.controlEpoch,
    expectedEpoch: state.controlEpoch,
    holdDispatch: state.holdDispatch,
  };
}
