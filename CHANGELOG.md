# Changelog

All notable changes to this project are documented in this file.
This project uses a four-digit version format: `MAJOR.MINOR.PATCH.MICRO`.

## [0.1.2.0] - 2026-03-22

### Added

- A bridge API and UI for checking Tauri MCP setup and managing driver sessions.
- Server-side bridge tests for plugin detection and CLI response parsing.

### Changed

- Grecko now reports the real bridge state of a target repo, including explicit
  missing-plugin status for Stonefruit today.

## [0.1.1.0] - 2026-03-22

### Added

- A local runner API that can launch and stop one target app command at a time.
- A Grecko runner panel showing active PID, working directory, exit state, and log tail.
- Server-side test coverage for runner validation and process lifecycle behavior.

### Changed

- `npm run dev` now starts both the frontend and the local runner API.
- Architecture and README docs now describe the executable app-launch path.

## [0.1.0.0] - 2026-03-22

### Added

- Initial Grecko repository and public GitHub remote.
- A branded Vite + React prototype for the Grecko release-confidence control room.
- Release-page intake seeded with the Stonefruit GitLab releases URL.
- Mocked verdict, platform coverage, findings, and Tauri MCP harness guidance.
- Vitest and Testing Library coverage for release intake logic and the main UI.
- Repo docs for architecture, testing, and Claude-session conventions.
