# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast,
trust your instincts, and ship with confidence. Without them, vibe coding is
just yolo coding.

## Framework

- Vitest
- Testing Library
- JSDOM

## Commands

```bash
npm run test
npm run test:run
```

## Current Layers

- Unit tests
  - provider detection and intake validation in `src/lib`
- Run dossier tests
  - deterministic execution verdict and stage transitions in `server/runs-store.test.js`
- Harness tests
  - local URL detection for the no-integration browser harness in `server/harness-store.test.js`
- Runner tests
  - local process validation plus start/stop lifecycle coverage in `server/`
- Bridge tests
  - plugin detection and CLI-status parsing in `server/bridge-store.test.js`
- UI tests
  - launch surface rendering and intake state changes in `src/App.test.tsx`

## Conventions

- Keep tests next to the source they verify.
- Prefer behavior assertions over implementation details.
- When changing intake logic, add a regression test for the specific URL case.
- When changing runner logic, cover both the success path and the stop path.
- When changing run-verdict logic, cover both incomplete and fully-connected cases.
- When changing harness logic, cover the URL-detection or interaction path you changed.
- When changing bridge logic, cover both missing-setup and valid-setup cases.
- When changing the launch surface, verify the user-visible copy or interaction.
