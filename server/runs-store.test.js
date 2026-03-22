import { describe, expect, it } from 'vitest'
import { applyExecutionEvidence, computeRunVerdict } from './runs-store.js'

function createBaseRun() {
  return {
    id: 'run-1',
    createdAt: '2026-03-22T00:00:00.000Z',
    status: 'resolved',
    releaseUrl: 'https://gitlab.futo.org/stonefruit/stonefruit/-/releases',
    provider: 'gitlab',
    release: {
      targetStatuses: [
        {
          target: 'linux',
          status: 'ready',
          summary: 'Selected Linux artifact.',
          selectedAsset: { name: 'stonefruit.AppImage' },
        },
        {
          target: 'android',
          status: 'ready',
          summary: 'Selected Android artifact.',
          selectedAsset: { name: 'stonefruit.apk' },
        },
      ],
    },
    baseline: {
      status: 'missing',
      summary: 'No baseline.',
    },
    execution: null,
    stages: {
      intake: 'completed',
      launch: 'pending',
      harness: 'pending',
      bridge: 'pending',
    },
  }
}

describe('computeRunVerdict', () => {
  it('stays investigate until execution evidence exists', () => {
    const verdict = computeRunVerdict(createBaseRun())

    expect(verdict.label).toBe('investigate')
    expect(verdict.reasonCodes).toContain('RUN_NOT_EXECUTED')
  })

  it('blocks when launch evidence shows a failed command', () => {
    const run = applyExecutionEvidence(createBaseRun(), {
      command: 'npm run tauri:dev',
      cwd: '/tmp/stonefruit',
      port: 9223,
      startedAt: '2026-03-22T00:01:00.000Z',
      lastSyncedAt: '2026-03-22T00:01:03.000Z',
      runner: {
        id: '1',
        command: 'npm run tauri:dev',
        cwd: '/tmp/stonefruit',
        pid: 123,
        status: 'failed',
        startedAt: '2026-03-22T00:01:00.000Z',
        endedAt: '2026-03-22T00:01:03.000Z',
        exitCode: 1,
        signal: null,
        logs: [],
      },
      harness: null,
      bridge: null,
    })

    expect(run.stages.launch).toBe('failed')
    expect(run.verdict.label).toBe('block')
    expect(run.verdict.reasonCodes).toContain('LAUNCH_FAILED')
  })

  it('marks a run ship-ready once launch and no-integration harness both succeed', () => {
    const run = applyExecutionEvidence(createBaseRun(), {
      command: 'npm run tauri:dev',
      cwd: '/tmp/stonefruit',
      port: 9223,
      startedAt: '2026-03-22T00:01:00.000Z',
      lastSyncedAt: '2026-03-22T00:01:03.000Z',
      runner: {
        id: '1',
        command: 'npm run tauri:dev',
        cwd: '/tmp/stonefruit',
        pid: 123,
        status: 'running',
        startedAt: '2026-03-22T00:01:00.000Z',
        endedAt: null,
        exitCode: null,
        signal: null,
        logs: [],
      },
      harness: {
        id: 'harness-1',
        status: 'attached',
        attachedAt: '2026-03-22T00:01:01.000Z',
        lastActionAt: '2026-03-22T00:01:03.000Z',
        currentUrl: 'http://127.0.0.1:5180/',
        targetUrl: 'http://127.0.0.1:5180/',
        title: 'Stonefruit (dev)',
        interactionCount: 1,
        buttons: [{ index: 0, text: 'New', ariaLabel: 'New note', tagName: 'button' }],
        fields: [],
        bodyTextExcerpt: 'Stonefruit Create your first note from the sidebar to get started.',
        screenshotDataUrl: null,
        logs: [],
      },
      bridge: {
        cwd: '/tmp/stonefruit',
        port: 9223,
        command: 'tauri-mcp driver-session status --json',
        status: 'ready',
        connected: true,
        setupDetected: true,
        setupSummary: 'Detected.',
        app: 'stonefruit',
        identifier: '9223',
        host: '127.0.0.1',
        logs: [],
      },
    })

    expect(run.stages.launch).toBe('running')
    expect(run.stages.harness).toBe('completed')
    expect(run.stages.bridge).toBe('completed')
    expect(run.verdict.label).toBe('ship')
    expect(run.verdict.reasonCodes).toContain('HARNESS_USED')
  })

  it('stays investigate when the app launches but bridge setup is missing', () => {
    const run = applyExecutionEvidence(createBaseRun(), {
      command: 'npm run tauri:dev',
      cwd: '/tmp/stonefruit',
      port: 9223,
      startedAt: '2026-03-22T00:01:00.000Z',
      lastSyncedAt: '2026-03-22T00:01:03.000Z',
      runner: {
        id: '1',
        command: 'npm run tauri:dev',
        cwd: '/tmp/stonefruit',
        pid: 123,
        status: 'running',
        startedAt: '2026-03-22T00:01:00.000Z',
        endedAt: null,
        exitCode: null,
        signal: null,
        logs: [],
      },
      harness: null,
      bridge: {
        cwd: '/tmp/stonefruit',
        port: 9223,
        command: 'tauri-mcp driver-session status --json',
        status: 'unavailable',
        connected: false,
        setupDetected: false,
        setupSummary: 'Plugin missing.',
        app: null,
        identifier: null,
        host: null,
        logs: [],
      },
    })

    expect(run.stages.bridge).toBe('unavailable')
    expect(run.verdict.label).toBe('investigate')
    expect(run.verdict.reasonCodes).toContain('BRIDGE_PLUGIN_MISSING')
  })

  it('ships when the bridge is missing but the browser harness can use the app', () => {
    const run = applyExecutionEvidence(createBaseRun(), {
      command: 'npm run tauri:dev',
      cwd: '/tmp/stonefruit',
      port: 9223,
      startedAt: '2026-03-22T00:01:00.000Z',
      lastSyncedAt: '2026-03-22T00:01:03.000Z',
      runner: {
        id: '1',
        command: 'npm run tauri:dev',
        cwd: '/tmp/stonefruit',
        pid: 123,
        status: 'running',
        startedAt: '2026-03-22T00:01:00.000Z',
        endedAt: null,
        exitCode: null,
        signal: null,
        logs: [],
      },
      harness: {
        id: 'harness-1',
        status: 'attached',
        attachedAt: '2026-03-22T00:01:01.000Z',
        lastActionAt: '2026-03-22T00:01:03.000Z',
        currentUrl: 'http://127.0.0.1:5180/',
        targetUrl: 'http://127.0.0.1:5180/',
        title: 'Stonefruit (dev)',
        interactionCount: 2,
        buttons: [{ index: 0, text: 'New', ariaLabel: 'New note', tagName: 'button' }],
        fields: [{ index: 0, tagName: 'textarea', type: '', placeholder: '', ariaLabel: '', name: '', value: 'Grecko QA note' }],
        bodyTextExcerpt: 'Stonefruit Grecko QA note',
        screenshotDataUrl: null,
        logs: [],
      },
      bridge: {
        cwd: '/tmp/stonefruit',
        port: 9223,
        command: 'tauri-mcp driver-session status --json',
        status: 'unavailable',
        connected: false,
        setupDetected: false,
        setupSummary: 'Plugin missing.',
        app: null,
        identifier: null,
        host: null,
        logs: [],
      },
    })

    expect(run.stages.harness).toBe('completed')
    expect(run.stages.bridge).toBe('unavailable')
    expect(run.verdict.label).toBe('ship')
    expect(run.verdict.reasonCodes).toContain('HARNESS_USED')
  })
})
