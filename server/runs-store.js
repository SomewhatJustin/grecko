import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { computeIntakeVerdict, resolveRelease } from './release-resolver.js'
import { checkBridge, getBridgeSession } from './bridge-store.js'
import { getRunnerSession, startRunner } from './runner-store.js'

const dataDir = path.join(process.cwd(), '.grecko-data', 'runs')
const EXECUTION_WAIT_MS = 3_000

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true })
}

function runFilePath(runId) {
  return path.join(dataDir, `${runId}.json`)
}

function readRun(runId) {
  const filePath = runFilePath(runId)

  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeRun(run) {
  ensureDataDir()
  fs.writeFileSync(runFilePath(run.id), JSON.stringify(run, null, 2))
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function summarizeRunnerState(runnerSession) {
  if (!runnerSession) {
    return {
      stage: 'pending',
      reasonCodes: ['RUN_NOT_EXECUTED'],
      summary: 'Grecko has not launched the target app for this run yet.',
    }
  }

  if (runnerSession.status === 'failed') {
    return {
      stage: 'failed',
      reasonCodes: ['LAUNCH_FAILED'],
      summary: 'Grecko launched the target app, but the command failed.',
    }
  }

  if (runnerSession.status === 'running') {
    return {
      stage: 'running',
      reasonCodes: ['LAUNCH_RUNNING'],
      summary: 'Grecko launched the target app and it is still running.',
    }
  }

  return {
    stage: 'completed',
    reasonCodes: ['LAUNCH_COMPLETED'],
    summary: 'Grecko launched the target app and captured exit evidence.',
  }
}

function summarizeBridgeState(bridgeSession) {
  if (!bridgeSession) {
    return {
      stage: 'pending',
      reasonCodes: ['BRIDGE_NOT_CHECKED'],
      summary: 'Grecko has not checked the Tauri MCP bridge for this run yet.',
    }
  }

  if (!bridgeSession.setupDetected) {
    return {
      stage: 'unavailable',
      reasonCodes: ['BRIDGE_PLUGIN_MISSING'],
      summary: bridgeSession.setupSummary,
    }
  }

  if (bridgeSession.status === 'failed') {
    return {
      stage: 'failed',
      reasonCodes: ['BRIDGE_CHECK_FAILED'],
      summary: 'Grecko could not start or verify the Tauri MCP bridge session.',
    }
  }

  if (bridgeSession.connected) {
    return {
      stage: 'completed',
      reasonCodes: ['BRIDGE_CONNECTED'],
      summary: 'Grecko connected to the Tauri MCP bridge.',
    }
  }

  return {
    stage: 'pending',
    reasonCodes: ['BRIDGE_PENDING_CONNECTION'],
    summary:
      'Grecko checked the bridge setup, but there is no active Tauri MCP driver session yet.',
  }
}

export function computeRunVerdict(run) {
  const intakeVerdict = computeIntakeVerdict(run.release)

  if (intakeVerdict.label === 'block') {
    return intakeVerdict
  }

  const launch = summarizeRunnerState(run.execution?.runner ?? null)
  const bridge = summarizeBridgeState(run.execution?.bridge ?? null)

  if (launch.stage === 'failed') {
    return {
      label: 'block',
      reasonCodes: ['INTAKE_READY', ...launch.reasonCodes],
      summary: 'Release intake passed, but Grecko could not launch the target app cleanly.',
    }
  }

  if (launch.stage === 'pending') {
    return {
      label: 'investigate',
      reasonCodes: ['INTAKE_READY', ...launch.reasonCodes],
      summary:
        'Release intake is complete and Grecko found Linux + Android artifacts, but execution evidence has not been collected yet.',
    }
  }

  if (bridge.stage === 'completed') {
    return {
      label: 'ship',
      reasonCodes: ['INTAKE_READY', ...launch.reasonCodes, ...bridge.reasonCodes],
      summary:
        'Grecko resolved the release, launched the target app, and connected to the Tauri MCP bridge.',
    }
  }

  return {
    label: 'investigate',
    reasonCodes: ['INTAKE_READY', ...launch.reasonCodes, ...bridge.reasonCodes],
    summary:
      'Grecko resolved the release and captured launch evidence, but the bridge layer still needs attention before this run can clear to ship.',
  }
}

function computeStages(execution) {
  const launch = summarizeRunnerState(execution?.runner ?? null)
  const bridge = summarizeBridgeState(execution?.bridge ?? null)

  return {
    intake: 'completed',
    launch: launch.stage,
    bridge: bridge.stage,
  }
}

export function applyExecutionEvidence(run, execution) {
  const nextRun = {
    ...run,
    status: execution?.runner?.status === 'failed' ? 'attention' : 'executed',
    execution,
  }

  nextRun.stages = computeStages(nextRun.execution)
  nextRun.verdict = computeRunVerdict(nextRun)
  return nextRun
}

export function listRuns() {
  ensureDataDir()
  return fs
    .readdirSync(dataDir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) =>
      JSON.parse(fs.readFileSync(path.join(dataDir, entry), 'utf8')),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export async function createRun({ releaseUrl }) {
  const release = await resolveRelease(releaseUrl)
  const run = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'resolved',
    releaseUrl,
    provider: release.provider,
    release,
    baseline: {
      status: 'missing',
      summary: 'No baseline run has been recorded for this release target yet.',
    },
    execution: null,
    stages: {
      intake: 'completed',
      launch: 'pending',
      bridge: 'pending',
    },
  }

  run.verdict = computeRunVerdict(run)
  writeRun(run)
  return run
}

export function getRun(runId) {
  return readRun(runId)
}

export function syncRunExecution({ runId }) {
  const run = readRun(runId)

  if (!run) {
    throw new Error('Grecko could not find that run.')
  }

  if (!run.execution) {
    throw new Error('This run has not been executed yet.')
  }

  const runner = getRunnerSession()
  const bridge = checkBridge({
    cwd: run.execution.cwd,
    port: run.execution.port,
  })

  const nextRun = applyExecutionEvidence(run, {
    ...run.execution,
    lastSyncedAt: new Date().toISOString(),
    runner,
    bridge,
  })

  writeRun(nextRun)
  return nextRun
}

export async function executeRun({ runId, command, cwd, port }) {
  const run = readRun(runId)

  if (!run) {
    throw new Error('Grecko could not find that run.')
  }

  const startedRunner = startRunner({ command, cwd })
  await wait(EXECUTION_WAIT_MS)

  const runner = getRunnerSession() ?? startedRunner
  const bridge = checkBridge({ cwd, port })
  const previousBridge = getBridgeSession()

  const nextRun = applyExecutionEvidence(run, {
    command,
    cwd,
    port,
    startedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    runner,
    bridge: bridge ?? previousBridge,
  })

  writeRun(nextRun)
  return nextRun
}
