# CLAUDE.md

## Product

Grecko is a release-confidence tool for Tauri apps. The first repository cut is
a frontend prototype shaped around public release-page intake, a local app
runner, and a verdict-led control room.

## Harness Notes

- Prefer the Hypothesi Tauri MCP server for app-aware harness control:
  `npx -y install-mcp @hypothesi/tauri-mcp-server --client claude-code`
- Prefer the CLI fallback for local bridge inspection when `tauri-mcp` is not
  installed globally:
  `npx -y --package @hypothesi/tauri-mcp-cli tauri-mcp`
- The Stonefruit GitLab releases URL is the primary real-world seed fixture:
  `https://gitlab.futo.org/stonefruit/stonefruit/-/releases`
- The local runner API listens on `http://127.0.0.1:4174` by default.

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
