# @bat-cowork/cowork-core

Pure in-memory task reducer and cowork rules. This package implements the task state machine, dispatch policy, and capabilities needed for BAT-Cowork's server-first development workstation. It does not open sockets, spawn agents, or decide that a task is done.

## Core Modules

### `task-core.ts`

Implements the task state machine and reducer. Tasks move through phases (`active`, `paused`, `verified`, etc.) based on events like instructions, control actions (pause, takeover, release), and verifier results.

### `dispatch-policy.ts`

Defines the `evaluateDispatch` pure function which decides if an actor is allowed to execute a specific write operation (like a terminal command or a git commit) based on the current task state, revision, and epoch.

### `session-ingress.ts`

Inventories the inbound messages that Paseo accepts from a client session and gates them for BAT-Cowork. Standard mutations are held or rejected unless authorized by the task state.

### `providers.ts`

Tracks the admission status of agent providers like Claude, Codex, and Grok against the locked baseline.

## API Reference

### `createTask(params)`

Creates a new task starting in the `active` phase.

```ts
import { createTask } from "@bat-cowork/cowork-core";

const task = createTask({
  id: "task-1",
  driverId: "client-a",
  worktreeId: "wt-1",
  evidence: null,
});
```

### `step(state, event)`

Transitions the task state based on a new event. Returns the next state and any emitted intents (e.g. `dispatch`, `repair`).

```ts
import { step } from "@bat-cowork/cowork-core";

const result = step(task, {
  type: "instruction",
  id: "evt-1",
  role: "driver",
  actor: "client-a",
  text: "Refactor the API layer",
});

// result.state represents the updated task state
// result.intents may contain commands to dispatch
```

### `evaluateDispatch(input)`

Checks if a dispatch action is permitted.

```ts
import { evaluateDispatch } from "@bat-cowork/cowork-core";

const decision = evaluateDispatch({
  actor: "client-a",
  effect: "write",
  revision: 1,
  expectedRevision: 1,
  epoch: 0,
  expectedEpoch: 0,
  resourceWriter: "client-a",
  actorIsWriter: true,
  commandId: "cmd-1",
  alreadyDispatched: false,
});

if (!decision.allow) {
  throw new Error(`Dispatch denied: ${decision.reason}`);
}
```

### `assertIngressGated(type)`

Throws an error if a stock Paseo command is not authorized as a cowork command. Used by the server to refuse unmanaged requests.

### `assertProviderAdmitted(id)`

Throws an error if the specified provider (e.g., `'claude'`) is not admitted for dispatch in the current baseline.

## Testing

Run tests locally with Node.js built-in test runner (no `npm install` needed in this directory):

```sh
node --experimental-strip-types --test test/*.test.ts
```
