# Architecture

## Current State

This repo is now a frontend control room plus a small local execution API for
Grecko, not the full release-verdict system yet. It exists to lock in:

- brand and product framing
- the release-intake interaction and persistence model
- the local app-launch path
- the no-integration browser harness path
- the bridge setup/session path
- the verdict vocabulary and deterministic reason codes
- the evidence-first layout direction
- the Tauri harness integration story

## Frontend Structure

- `src/App.tsx`
  - single-page launch surface with intake, runner, verdict, findings, and harness sections
- `src/lib/release-intake.ts`
  - small pure helper for release-provider detection and intake messaging
- `src/lib/runs-client.ts`
  - browser client for persisted run creation, execution, and evidence sync
- `src/lib/harness-client.ts`
  - browser client for attaching, refreshing, and driving the no-integration harness
- `src/lib/runner-client.ts`
  - browser client for polling and controlling the local runner API
- `src/lib/bridge-client.ts`
  - browser client for MCP bridge check/start/stop flows
- `server/index.js`
  - minimal Node HTTP API for runs, runner, and bridge session control
- `server/release-resolver.js`
  - public GitHub/GitLab release resolution plus Linux/Android asset selection
- `server/harness-store.js`
  - Chrome-backed no-integration app harness for URL detection, DOM snapshots, clicks, typing, and screenshots
- `server/runs-store.js`
  - persisted run records, deterministic verdict evaluation, and execution sync across launch, harness, and bridge evidence
- `server/runner-store.js`
  - in-memory process lifecycle management and log capture
- `server/bridge-store.js`
  - Tauri MCP setup detection plus CLI-backed bridge session inspection
- `src/*.test.tsx?`
  - regression coverage for intake, execution verdicts, runner behavior, and the main surface

## Product Decisions Captured Here

- Grecko starts from a public release page instead of generic repo plumbing
- Grecko can launch one explicit local app command at a time
- Grecko stores runs as evidence-rich case files under `.grecko-data/runs`
- Grecko treats browser-level app usage as the primary v1 harness path
- Grecko should surface missing bridge setup as a first-class state, not a vague CLI failure
- The first release envelope is Linux + Android
- Verdict language is explicit: `ship`, `investigate`, `block`
- Evidence and platform coverage should remain visible even when incomplete
- Tauri MCP integration is first-class in the harness story

## Near-Term Buildout

1. Persist runner and bridge session history beyond the current in-memory singleton.
2. Store baseline identity per project, platform, and channel.
3. Add richer execution stages beyond launch, browser harness, and bridge setup.
4. Expand the no-integration harness beyond button and field actions.
5. Expand platform expectations beyond Linux and Android.
