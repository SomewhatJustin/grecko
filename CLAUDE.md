# CLAUDE.md

## Product

Grecko is a release-confidence tool for Tauri apps. The first repository cut is
a control-room prototype shaped around public release-page intake, persisted run
dossiers, a local app runner, a no-integration browser harness, and a
verdict-led evidence flow.

## Harness Notes

- Prefer the Hypothesi Tauri MCP server for app-aware harness control:
  `npx -y install-mcp @hypothesi/tauri-mcp-server --client claude-code`
- Prefer the CLI fallback for local bridge inspection when `tauri-mcp` is not
  installed globally:
  `npx -y --package @hypothesi/tauri-mcp-cli tauri-mcp`
- The Stonefruit GitLab releases URL is the primary real-world seed fixture:
  `https://gitlab.futo.org/stonefruit/stonefruit/-/releases`
- The local runner API listens on `http://127.0.0.1:4174` by default.
- Persisted run data is stored under `.grecko-data/runs`.
- Stonefruit is now a verified no-integration target because Grecko can launch
  it and use the app through the browser harness, even though the MCP bridge
  plugin is not installed yet.

## Testing

- Run command: `npm run test:run`
- Test directory: colocated tests in `src/`
- Reference: `TESTING.md`
- Expectations:
  - 100% test coverage is the goal
  - when writing new functions, write a corresponding test
  - when fixing a bug, write a regression test
  - when adding error handling, write a test that triggers the error
  - when adding a conditional, write tests for both paths
  - never commit code that makes existing tests fail
