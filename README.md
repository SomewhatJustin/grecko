# Grecko

Grecko is a release-confidence control room for Tauri apps. The product goal is
simple: give a builder a public release page, inspect the app with harnesses,
and answer one question clearly: `ship`, `investigate`, or `block`.

This first repo cut turns the earlier planning work into a concrete prototype:

- a branded launch surface for `grecko.dev`
- release-page intake seeded with the Stonefruit GitLab releases URL
- a mocked run dossier with verdict, platform coverage, and findings
- a local app runner that can launch and stop a target command
- repo-local docs for architecture, testing, and Tauri MCP integration notes

## Current Scope

This repository is intentionally narrow:

- public GitHub and GitLab release page intake
- Linux and Android as the first explicit platform envelope
- a working local app runner for user-supplied launch commands
- deterministic verdict language and evidence-first UI direction

The full verification engine, persistence layer, and baseline registry are still
future work. This repo now establishes the product shape plus the first local
execution path for launching an app Grecko should inspect.

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

## Verification

```bash
npm run test:run
npm run build
```

See [TESTING.md](./TESTING.md) for the repo test conventions and
[ARCHITECTURE.md](./ARCHITECTURE.md) for the current product structure.
