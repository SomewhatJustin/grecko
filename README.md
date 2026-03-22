# Grecko

Grecko is a release-confidence control room for Tauri apps. The product goal is
simple: give a builder a public release page, inspect the app with harnesses,
and answer one question clearly: `ship`, `investigate`, or `block`.

This first repo cut turns the earlier planning work into a concrete prototype:

- a branded launch surface for `grecko.dev`
- persisted release-page intake seeded with the Stonefruit GitLab releases URL
- executable run dossiers with verdict, platform coverage, and findings
- a local app runner that can launch and stop a target command
- Tauri MCP bridge inspection and session controls
- run execution and sync flows that attach launch and bridge evidence to a saved run
- repo-local docs for architecture, testing, and Tauri MCP integration notes

## Current Scope

This repository is intentionally narrow:

- public GitHub and GitLab release page intake
- Linux and Android as the first explicit platform envelope
- a working local app runner for user-supplied launch commands
- Tauri MCP bridge setup detection and driver-session controls
- deterministic verdict language and evidence-first UI direction

The full verification engine and baseline registry are still future work. This
repo now establishes the product shape plus the first local execution path for
resolving a release, launching the app, recording bridge state, and keeping the
run dossier in sync.

## Example Release Target

Grecko is currently seeded with the public Stonefruit releases page:

`https://gitlab.futo.org/stonefruit/stonefruit/-/releases`

That gives the product a real intake target from day one instead of a toy URL.

## Tauri MCP Direction

For app-aware harnessing, this repo assumes the
[`@hypothesi/tauri-mcp-server`](https://github.com/hypothesi/mcp-server-tauri)
bridge is the default integration path. The upstream quick-start install command
is:

```bash
npx -y install-mcp @hypothesi/tauri-mcp-server --client claude-code
```

The relevant capabilities for Grecko are:

- screenshots and DOM snapshots
- console, system, and mobile log access
- IPC monitoring for Tauri commands
- mobile device listing

## Development

```bash
npm install
npm run dev
```

`npm run dev` starts both the Vite client and the local runner API. If you only
want the runner API, use:

```bash
npm run server
```

## Running Apps

Grecko can now launch one local app command at a time through the runner panel.
Provide:

- the exact launch command, for example `npm run tauri dev`
- the working directory of the target app, for example
  `/home/justin/Developer/stonefruit`

The runner API:

- starts the process locally on your machine
- exposes current PID, status, exit information, and recent log output
- lets the UI stop the active process cleanly

## Runs

Grecko now persists intake and execution records under `.grecko-data/runs`.

- `Create run` resolves a public release page into a saved intake record
- `Execute active run` launches the configured app, waits for early boot logs,
  checks the bridge state, and stores both snapshots on the run
- `Sync evidence` refreshes the active run from the current runner and bridge
  state so the verdict can move from `running` to `completed`

The current verdict engine is deterministic:

- `block` when required Linux or Android assets are missing, or when launch fails
- `investigate` when intake is ready but launch or bridge evidence is incomplete
- `ship` only when intake is ready, the app launch succeeded, and the Tauri MCP
  bridge is connected

## MCP Bridge

Grecko now checks and controls the Tauri MCP bridge as a separate step.

- `Check bridge` inspects the target repo for `tauri-plugin-mcp-bridge` and
  queries `tauri-mcp driver-session status --json`
- `Start bridge session` starts a driver session only if the plugin is already
  configured in the target app
- `Stop bridge session` tears down the current CLI session

Grecko prefers a global `tauri-mcp` binary when available and falls back to:

```bash
npx -y --package @hypothesi/tauri-mcp-cli tauri-mcp
```

The current Stonefruit verification result is accurate but incomplete: Grecko
can run Stonefruit today, but Stonefruit does not yet have the Tauri MCP bridge
plugin installed, so Grecko records a real `investigate` run with
`BRIDGE_PLUGIN_MISSING` instead of pretending the bridge layer is healthy.

## Verification

```bash
npm run test:run
npm run build
```

See [TESTING.md](./TESTING.md) for the repo test conventions and
[ARCHITECTURE.md](./ARCHITECTURE.md) for the current product structure.
