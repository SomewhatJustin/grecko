# Architecture

## Current State

This repo is now a frontend prototype plus a small local runner API for Grecko,
not the full release-verdict system yet. It exists to lock in:

- brand and product framing
- the release-intake interaction
- the local app-launch path
- the verdict vocabulary
- the evidence-first layout direction
- the Tauri harness integration story

## Frontend Structure

- `src/App.tsx`
  - single-page launch surface with intake, runner, verdict, findings, and harness sections
- `src/lib/release-intake.ts`
  - small pure helper for release-provider detection and intake messaging
- `src/lib/runner-client.ts`
  - browser client for polling and controlling the local runner API
- `server/index.js`
  - minimal Node HTTP API for starting, stopping, and inspecting the active app session
- `server/runner-store.js`
  - in-memory process lifecycle management and log capture
- `src/*.test.tsx?`
  - regression coverage for the intake helper, runner API, and main rendered surface

## Product Decisions Captured Here

- Grecko starts from a public release page instead of generic repo plumbing
- Grecko can launch one explicit local app command at a time
- The first release envelope is Linux + Android
- Verdict language is explicit: `ship`, `investigate`, `block`
- Evidence and platform coverage should remain visible even when incomplete
- Tauri MCP integration is first-class in the harness story

## Near-Term Buildout

1. Persist runner sessions instead of keeping them in memory only.
2. Resolve release assets from GitHub and GitLab pages.
3. Connect launched apps to the Tauri MCP bridge automatically.
4. Store baseline identity per project, platform, and channel.
5. Replace mocked verdicts with deterministic reason-code evaluation.
