# bat-cowork

**English** · [繁體中文](README.zh-TW.md)

Work in progress: the Better Agent Terminal (BAT) desktop UI on a daemon derived from [Paseo](https://github.com/getpaseo/paseo), with the task rules inside the daemon.

**Project page:** https://teddashh.github.io/bat-cowork/

> **Not an official Paseo or Better Agent Terminal build, and not a release.** There are no tags, no signing key, and no updater. Do not point it at a production daemon or an existing BAT session.

## What this repository is

A derivative of Paseo at commit `cf2b3f4` (Paseo 0.11.0-beta.4). The fork started from `53ee9cd` (Paseo 0.10.0). Paseo's server, client, protocol, and CLI stay on their upstream paths. This repository adds:

- `apps/bat-desktop`: the BAT renderer, imported from Better Agent Terminal at `41ea2b1`, plus a new Tauri crate with its own app id and no updater. The Tauri shell does not compile yet; a browser shell can read a local daemon.
- `packages/cowork-core`: the task rules (one driver per task; viewers can comment and propose), the dispatch policy, and an inventory of Paseo's inbound messages.
- `packages/server/src/server/cowork`: a send gate for managed agents and a task journal at `{paseoHome}/cowork/tasks.json`.
- Changes to seven upstream Paseo files (237 lines added, 1 removed) that wire the cowork code in.

## Status

From [docs/cowork/RELEASE-GATE.md](docs/cowork/RELEASE-GATE.md):

| Package | Status         | Evidence                                                                                                                                                                                                                                                                        |
| ------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W0      | accepted       | `docs/cowork/W0-REPORT.md`                                                                                                                                                                                                                                                      |
| W1      | not accepted   | `w1-session.e2e.test.ts` shows sessions, files, and that closing the client leaves the daemon up. Tauri does not compile.                                                                                                                                                       |
| W2      | not accepted   | `w2-same-run.e2e.test.ts` and `w2-stream.e2e.test.ts`. Two local clients see one run, the permission, and the reply. The same message id does not run twice. A daemon-created worktree receives the commit and the main checkout does not move. Official Codex is not admitted. |
| W3      | local evidence | `task-w3.e2e.test.ts`                                                                                                                                                                                                                                                           |
| W4      | not accepted   | `w4-control.e2e.test.ts` is two principals and two worktrees. `cowork-append.e2e.test.ts` stamps a comment with the client id and rejects a viewer pause. Hermes and Grokbot are not running.                                                                                   |
| W5      | not accepted   | `ui-parity.ts`, `w5-history.test.ts`, and `cowork-tasks.e2e.test.ts`. Commit history, task receipts, and the task timeline are readable. Claude and Codex are not admitted. The terminal stays refused.                                                                         |
| W6      | not accepted   | this file. `w6-journal.test.ts` migrates an old wrapper and restores a snapshot.                                                                                                                                                                                                |

A package marked not accepted is not cleared for cutover, and cutover is closed. All of this ran on a local test daemon with an in-process fake Claude client. No agent provider (Claude, Codex, Grok) is admitted for dispatch.

## Credits and license

- [Paseo](https://github.com/getpaseo/paseo) is by Mohamed Boudra and other Paseo contributors. It is licensed under the Apache License 2.0, except third-party components, which keep their own licenses. See [LICENSE](LICENSE).
- [Better Agent Terminal](https://github.com/tony1223/better-agent-terminal) is by TonyQ. The imported UI is MIT licensed; its license and copyright notice are kept in [apps/bat-desktop/BAT-LICENSE](apps/bat-desktop/BAT-LICENSE).
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lists the upstream commits and what is and is not included.

Project notes: [BAT-COWORK.md](BAT-COWORK.md). Work package status and evidence: [docs/cowork/](docs/cowork/). Traditional Chinese: [README.zh-TW.md](README.zh-TW.md).

---

## Upstream Paseo README

Everything below is Paseo's own README from commit `cf2b3f4`. The only edit is punctuation: dashes in list items became colons. Its badges, downloads, and install steps describe upstream Paseo, not this repository.

<p align="center">
  <img src="packages/website/public/logo.svg" width="64" height="64" alt="Paseo logo">
</p>

<h1 align="center">Paseo</h1>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/getpaseo/paseo/stargazers">
    <img src="https://img.shields.io/github/stars/getpaseo/paseo?style=flat&logo=github" alt="GitHub stars">
  </a>
  <a href="https://github.com/getpaseo/paseo/releases">
    <img src="https://img.shields.io/github/v/release/getpaseo/paseo?style=flat&logo=github" alt="GitHub release">
  </a>
  <a href="https://x.com/moboudra">
    <img src="https://img.shields.io/badge/%40moboudra-555?logo=x" alt="X">
  </a>
  <a href="https://discord.gg/jz8T2uahpH">
    <img src="https://img.shields.io/badge/Discord-555?logo=discord" alt="Discord">
  </a>
  <a href="https://www.reddit.com/r/PaseoAI/">
    <img src="https://img.shields.io/badge/Reddit-555?logo=reddit" alt="Reddit">
  </a>
</p>

<p align="center">One interface for Claude Code, Codex, Copilot, OpenCode, Pi, Antigravity, and Muse Code agents.</p>

<p align="center">
  <img src="https://paseo.sh/hero-mockup.png" alt="Paseo app screenshot" width="100%">
</p>

<p align="center">
  <img src="https://paseo.sh/mobile-mockup.png" alt="Paseo mobile app" width="100%">
</p>

Run agents in parallel on your own machines. Ship from your phone or your desk.

- **Self-hosted:** Agents run on your machine with your full dev environment. Use your tools, your configs, and your skills.
- **Multi-provider:** Claude Code, Codex, Copilot, OpenCode, Pi, Antigravity, and Muse Code through the same interface. Pick the right model for each job.
- **Voice control:** Dictate tasks or talk through problems in voice mode. Hands-free when you need it.
- **Cross-device:** iOS, Android, desktop, web, and CLI. Start work at your desk, check in from your phone, script it from the terminal.
- **Privacy-first:** Paseo doesn't have any telemetry, tracking, or forced log-ins.

## Plugins

Add themes, workspace panels, commands, settings screens, and coding-agent providers with trusted
TypeScript plugins. Install from npm, Git, or a local directory with `paseo plugin install <source>`.

Start with the [plugin quickstart](https://paseo.sh/docs/plugins). Plugins run with access to your daemon
machine and inside connected clients; install only code you trust.

## Getting Started

Paseo runs a local server called the daemon that manages your coding agents. Clients like the desktop app, mobile app, web app, and CLI connect to it.

### Prerequisites

You need at least one agent CLI installed and configured with your credentials:

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Codex](https://github.com/openai/codex)
- [GitHub Copilot](https://github.com/features/copilot/cli/)
- [OpenCode](https://github.com/anomalyco/opencode)
- [Pi](https://pi.dev)
- [Antigravity](https://paseo.sh/docs/supported-providers#antigravity)
- [Muse Code](https://paseo.sh/docs/muse-code)

### Desktop app (recommended)

Download it from [paseo.sh/download](https://paseo.sh/download) or the [GitHub releases page](https://github.com/getpaseo/paseo/releases). Open the app and the daemon starts automatically. Nothing else to install.

To connect from your phone, open **Settings → your host → Pair Device**.

### CLI / headless

Install the CLI and start Paseo:

```bash
npm install -g @getpaseo/cli
paseo
```

Paseo starts locally, then asks whether to enable the end-to-end encrypted relay for device pairing. If you decline, connect directly over TCP, Tailscale, or another VPN. This path is useful for servers and remote machines.

For full setup and configuration, see:

- [Docs](https://paseo.sh/docs)
- [Connectivity guide](https://paseo.sh/docs/connectivity)
- [Configuration reference](https://paseo.sh/docs/configuration)

### Docker

Run the Paseo daemon and self-hosted web UI in Docker:

```bash
docker run -d --name paseo \
  -p 6767:6767 \
  -e PASEO_PASSWORD=change-me \
  -v "$PWD/paseo-home:/home/paseo" \
  -v "$PWD:/workspace" \
  ghcr.io/getpaseo/paseo:latest
```

Open `http://localhost:6767` after it starts. Extend the base image with the agent CLIs you use, then provide credentials through environment variables or the persistent `/home/paseo` volume. See the [Docker documentation](docs/docker.md) for full setup details.

## CLI

Everything you can do in the app, you can do from the terminal.

```bash
paseo run --provider claude/opus-4.6 "implement user authentication"
paseo run --provider codex/gpt-5.5 --worktree feature-x "implement feature X"

paseo ls                           # list running agents
paseo attach abc123                # stream live output
paseo send abc123 "also add tests" # follow-up task

# run on a remote daemon; --cwd is a path on that host
paseo run --host workstation.local:6767 --cwd /workspace "run the full test suite"
```

See the [full CLI reference](https://paseo.sh/docs/cli) for more.

## TypeScript SDK

Build issue integrations, dashboards, and orchestration services with `@getpaseo/client`:

```ts
import { createPaseoClient } from "@getpaseo/client";

const client = createPaseoClient({ url: "ws://127.0.0.1:6767/ws" });
await client.connect();

const agent = await client.agents.create({
  config: { provider: "codex/gpt-5.5" },
  cwd: "/Users/me/dev/storefront",
  prompt: "Review the current diff and name the riskiest change.",
});

const result = await agent.waitForFinish();
console.log(result.lastMessage);

await client.close();
```

See the [SDK quickstart](https://paseo.sh/docs/sdk/quickstart), [recipes](https://paseo.sh/docs/sdk/recipes), and [API reference](https://paseo.sh/docs/sdk/reference).

## Skills

Skills teach your agent to use Paseo to orchestrate other agents.

```bash
npx skills add getpaseo/paseo
```

Then use them in any agent conversation:

- `/paseo-handoff`: hand off work between agents. I use this to plan with Claude and then handoff to Codex to implement.
- `/paseo-advisor`: spin up a single agent as an advisor for a second opinion, without delegating the work itself.
- `/paseo-committee`: form a committee of two contrasting agents to step back, do root cause analysis, and produce a plan.

## Development

Quick monorepo package map:

- `packages/server`: Paseo daemon (agent process orchestration, WebSocket API, MCP server)
- `packages/app`: Expo client (iOS, Android, web)
- `packages/cli`: `paseo` CLI for daemon and agent workflows
- `packages/desktop`: Electron desktop app
- `packages/relay`: Relay transport and encryption used by the daemon and clients
- `packages/website`: Marketing site and documentation (`paseo.sh`)

Common commands:

```bash
# run all local dev services
npm run dev

# run individual surfaces
npm run dev:server
npm run dev:app
npm run dev:desktop
npm run dev:website

# build the server stack
npm run build:server

# repo-wide checks
npm run typecheck
```

## Sponsors

Paseo is built by one person and funded by the people who use it. Support the work on [GitHub Sponsors](https://github.com/sponsors/boudra). Companies can [sponsor Paseo](https://paseo.sh/sponsor#spot) monthly and have their logo shown here and on the paseo.sh homepage.

<!-- Sponsor logos go here, in the same order as packages/website/src/data/sponsors.ts -->

## Related projects

- [getpaseo/paseo-relay](https://github.com/getpaseo/paseo-relay): official distributed relay, written in Elixir
- [paseo-vscode](https://marketplace.visualstudio.com/items?itemName=hinnes.paseo-vscode): VS Code extension

## License

Apache-2.0
