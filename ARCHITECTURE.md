# Architecture

## Current State

This repo is a frontend prototype for Grecko, not the full release-verdict
system yet. It exists to lock in:

- brand and product framing
- the release-intake interaction
- the verdict vocabulary
- the evidence-first layout direction
- the Tauri harness integration story

## Frontend Structure

- `src/App.tsx`
  - single-page launch surface with intake, verdict, findings, and harness sections
- `src/lib/release-intake.ts`
  - small pure helper for release-provider detection and intake messaging
- `src/*.test.tsx?`
  - regression coverage for the intake helper and the main rendered surface

## Product Decisions Captured Here

- Grecko starts from a public release page instead of generic repo plumbing
- The first release envelope is Linux + Android
- Verdict language is explicit: `ship`, `investigate`, `block`
- Evidence and platform coverage should remain visible even when incomplete
- Tauri MCP integration is first-class in the harness story

## Near-Term Buildout

1. Add persisted run data instead of mocked snapshots.
2. Resolve release assets from GitHub and GitLab pages.
3. Add a real harness executor and evidence ingestion path.
4. Store baseline identity per project, platform, and channel.
5. Replace mocked verdicts with deterministic reason-code evaluation.
