import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { computeIntakeVerdict, resolveRelease } from './release-resolver.js'
import { inspectAndroidApp, installAndroidApk, launchAndroidApp } from './android-store.js'
import { checkBridge, getBridgeSession } from './bridge-store.js'
import {
  attachHarness,
  clickHarness,
  getHarnessSession,
  pressHarness,
  refreshHarness,
  typeHarness,
} from './harness-store.js'
import { getScenarioDefinition } from './scenario-store.js'
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

  return hydrateRun(JSON.parse(fs.readFileSync(filePath, 'utf8')))
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

function summarizeLaunchState(execution) {
  if (execution?.android) {
    if (execution.android.status === 'failed') {
      return {
        stage: 'failed',
        reasonCodes: ['LAUNCH_FAILED'],
        summary: 'Grecko installed or launched the Android target, but the run failed.',
      }
    }

    if (execution.android.status === 'running') {
      return {
        stage: 'running',
        reasonCodes: ['LAUNCH_RUNNING'],
        summary: 'Grecko installed the Android artifact and the app is running on the target.',
      }
    }

    return {
      stage: 'completed',
      reasonCodes: ['LAUNCH_COMPLETED'],
      summary: 'Grecko installed and launched the Android target and captured exit evidence.',
    }
  }

  const runnerSession = execution?.runner ?? null

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

function summarizeHarnessState(harnessSession) {
  if (!harnessSession) {
    return {
      stage: 'pending',
      reasonCodes: ['HARNESS_NOT_ATTACHED'],
      summary: 'Grecko has not attached the no-integration harness yet.',
    }
  }

  if (harnessSession.status === 'failed') {
    return {
      stage: 'failed',
      reasonCodes: ['HARNESS_FAILED'],
      summary: 'Grecko could not attach the no-integration harness.',
    }
  }

  if (
    harnessSession.status === 'attached' &&
    (harnessSession.buttons.length > 0 ||
      harnessSession.fields.length > 0 ||
      harnessSession.bodyTextExcerpt)
  ) {
    return {
      stage: 'completed',
      reasonCodes:
        harnessSession.interactionCount > 0
          ? ['HARNESS_USED']
          : ['HARNESS_ATTACHED'],
      summary:
        'Grecko attached the no-integration harness and can inspect or use the app surface.',
    }
  }

  return {
    stage: 'pending',
    reasonCodes: ['HARNESS_PENDING'],
    summary: 'Grecko has not verified that the no-integration harness can use the app yet.',
  }
}

function summarizeScenarioState(scenarioExecution) {
  if (!scenarioExecution) {
    return {
      stage: 'pending',
      reasonCodes: ['SCENARIO_NOT_RUN'],
      summary: 'Grecko has not run a saved scenario against this release yet.',
    }
  }

  if (scenarioExecution.status === 'failed') {
    return {
      stage: 'failed',
      reasonCodes: ['SCENARIO_ASSERTION_FAILED'],
      summary: scenarioExecution.summary,
    }
  }

  if (scenarioExecution.status === 'passed') {
    return {
      stage: 'completed',
      reasonCodes: ['SCENARIO_PASSED'],
      summary: scenarioExecution.summary,
    }
  }

  return {
    stage: 'running',
    reasonCodes: ['SCENARIO_RUNNING'],
    summary: scenarioExecution.summary,
  }
}

export function computeRunVerdict(run) {
  const intakeVerdict = computeIntakeVerdict(run.release)

  if (intakeVerdict.label === 'block') {
    return intakeVerdict
  }

  const launch = summarizeLaunchState(run.execution ?? null)
  const harness = summarizeHarnessState(run.execution?.harness ?? null)
  const bridge = summarizeBridgeState(run.execution?.bridge ?? null)
  const scenario = summarizeScenarioState(run.execution?.scenario ?? null)

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

  if (scenario.stage === 'failed') {
    return {
      label: 'block',
      reasonCodes: ['INTAKE_READY', ...launch.reasonCodes, ...scenario.reasonCodes],
      summary: 'Grecko launched the target app, but the saved scenario failed.',
    }
  }

  if (scenario.stage === 'completed') {
    return {
      label: 'ship',
      reasonCodes: ['INTAKE_READY', ...launch.reasonCodes, ...scenario.reasonCodes],
      summary: 'Grecko launched the target app and passed the saved scenario checks.',
    }
  }

  if (harness.stage === 'completed') {
    return {
      label: 'ship',
      reasonCodes: ['INTAKE_READY', ...launch.reasonCodes, ...harness.reasonCodes],
      summary:
        'Grecko resolved the release, launched the target app, and exercised the no-integration harness.',
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
    reasonCodes: [
      'INTAKE_READY',
      ...launch.reasonCodes,
      ...harness.reasonCodes,
      ...bridge.reasonCodes,
    ],
    summary:
      'Grecko resolved the release and captured launch evidence, but it still needs either no-integration harness evidence or a bridge session before this run can clear to ship.',
  }
}

function computeStages(execution) {
  const launch = summarizeLaunchState(execution ?? null)
  const harness = summarizeHarnessState(execution?.harness ?? null)
  const bridge = summarizeBridgeState(execution?.bridge ?? null)
  const scenario = summarizeScenarioState(execution?.scenario ?? null)

  return {
    intake: 'completed',
    launch: launch.stage,
    harness: harness.stage,
    bridge: bridge.stage,
    scenario: scenario.stage,
  }
}

export function applyExecutionEvidence(run, execution) {
  const nextRun = {
    ...run,
    status:
      execution?.runner?.status === 'failed' || execution?.android?.status === 'failed'
        ? 'attention'
        : 'executed',
    execution,
  }

  nextRun.stages = computeStages(nextRun.execution)
  nextRun.verdict = computeRunVerdict(nextRun)
  return nextRun
}

function hydrateRun(run) {
  const hydrated = {
    ...run,
    execution: run.execution
      ? {
          ...run.execution,
          target:
            run.execution.target ?? (run.execution.android ? 'android' : 'desktop'),
          android: run.execution.android ?? null,
          harness: run.execution.harness ?? null,
          scenario: run.execution.scenario ?? null,
        }
      : null,
  }

  hydrated.stages = computeStages(hydrated.execution)
  hydrated.verdict = computeRunVerdict(hydrated)
  return hydrated
}

export function listRuns() {
  ensureDataDir()
  return fs
    .readdirSync(dataDir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) =>
      hydrateRun(JSON.parse(fs.readFileSync(path.join(dataDir, entry), 'utf8'))),
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
      harness: 'pending',
      bridge: 'pending',
      scenario: 'pending',
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

  const harness = getHarnessSession() ?? run.execution.harness ?? null
  const isAndroidRun = run.execution.target === 'android' || Boolean(run.execution.android)
  const runner = isAndroidRun ? run.execution.runner ?? null : getRunnerSession()
  const bridge = isAndroidRun
    ? run.execution.bridge ?? null
    : checkBridge({
        cwd: run.execution.cwd,
        port: run.execution.port,
      })
  const android = isAndroidRun
    ? (() => {
        const previous = run.execution.android

        if (!previous) {
          return null
        }

        const state = inspectAndroidApp({
          serial: previous.serial,
          packageName: previous.packageName,
        })

        return {
          ...previous,
          pid: state.pid,
          focused: state.focused,
          checkedAt: new Date().toISOString(),
          status: state.running ? 'running' : 'stopped',
        }
      })()
    : run.execution.android ?? null

  const nextRun = applyExecutionEvidence(run, {
    ...run.execution,
    lastSyncedAt: new Date().toISOString(),
    runner,
    android,
    harness,
    bridge,
  })

  writeRun(nextRun)
  return nextRun
}

export async function executeRun({
  runId,
  command,
  cwd,
  port,
  target,
  serial,
  packageName,
  activityName,
}) {
  const run = readRun(runId)

  if (!run) {
    throw new Error('Grecko could not find that run.')
  }

  if (target === 'android') {
    const apkUrl = run.release.selectedAssets?.android?.url

    if (!apkUrl) {
      throw new Error('This run does not have a resolved Android APK asset yet.')
    }

    const install = await installAndroidApk({
      serial,
      apkUrl,
    })
    const launch = launchAndroidApp({
      serial: install.serial,
      packageName,
      activityName,
    })

    let harness = null

    try {
      harness = await attachHarness({
        mode: 'android',
        serial: launch.serial,
        packageName: launch.packageName,
      })
    } catch {
      harness = getHarnessSession()
    }

    const now = new Date().toISOString()
    const nextRun = applyExecutionEvidence(run, {
      target: 'android',
      command: `adb install -r ${path.basename(install.apkPath)} && am start -n ${launch.activityName}`,
      cwd: `android://${launch.serial}`,
      port: port ?? 0,
      startedAt: now,
      lastSyncedAt: now,
      runner: null,
      android: {
        serial: launch.serial,
        packageName: launch.packageName,
        activityName: launch.activityName,
        status: 'running',
        installedApkPath: install.apkPath,
        installOutput: install.output,
        launchedAt: now,
        checkedAt: now,
        pid: null,
        focused: true,
        logs: [
          `[system] Installed APK ${path.basename(install.apkPath)} on ${launch.serial}.`,
          `[system] Launched ${launch.packageName} via ${launch.activityName}.`,
        ],
      },
      harness,
      bridge: null,
    })

    writeRun(nextRun)
    return nextRun
  }

  const startedRunner = startRunner({ command, cwd })
  await wait(EXECUTION_WAIT_MS)

  const runner = getRunnerSession() ?? startedRunner
  let harness = null

  try {
    harness = await attachHarness({})
  } catch {
    harness = getHarnessSession()
  }

  const bridge = checkBridge({ cwd, port })
  const previousBridge = getBridgeSession()

  const nextRun = applyExecutionEvidence(run, {
    target: 'desktop',
    command,
    cwd,
    port,
    startedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    runner,
    android: null,
    harness,
    bridge: bridge ?? previousBridge,
  })

  writeRun(nextRun)
  return nextRun
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/&#10;/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function findButtonIndexByText(session, text) {
  const normalizedNeedle = normalizeText(text)
  return session.buttons.findIndex((button) => normalizeText(button.text).includes(normalizedNeedle))
}

function harnessContainsText(session, text) {
  const haystack = [
    session.bodyTextExcerpt,
    ...session.buttons.map((button) => button.text),
    ...session.fields.map((field) => field.value),
  ]
    .map(normalizeText)
    .join(' ')

  return haystack.includes(normalizeText(text))
}

async function ensureScenarioHarness(run) {
  if (!run.execution) {
    throw new Error('Execute the run before starting a scenario.')
  }

  if (run.execution.target === 'android' || run.execution.android) {
    return attachHarness({
      mode: 'android',
      serial:
        run.execution.android?.serial ??
        run.execution.harness?.deviceSerial ??
        undefined,
      packageName:
        run.execution.android?.packageName ??
        run.execution.harness?.packageName ??
        undefined,
    })
  }

  return attachHarness({
    mode: 'browser',
    url:
      run.execution.harness?.targetUrl ??
      run.execution.harness?.currentUrl ??
      undefined,
  })
}

export async function executeScenarioRun({ runId, scenarioId }) {
  const run = readRun(runId)

  if (!run) {
    throw new Error('Grecko could not find that run.')
  }

  if (!run.execution) {
    throw new Error('Execute the run before starting a saved scenario.')
  }

  const scenario = getScenarioDefinition(scenarioId)

  if (!scenario) {
    throw new Error('Grecko could not find that scenario.')
  }

  const runTarget =
    run.execution.target === 'android' || run.execution.android ? 'android' : 'browser'

  if (scenario.target !== runTarget) {
    throw new Error(
      `Scenario "${scenario.name}" targets ${scenario.target}, but this run is ${runTarget}.`,
    )
  }

  let session = await ensureScenarioHarness(run)
  const stepResults = []
  let failed = false
  let failedAssertions = 0
  let passedAssertions = 0
  const startedAt = new Date().toISOString()

  for (const [index, step] of scenario.steps.entries()) {
    try {
      if (step.type === 'refreshHarness') {
        session = await refreshHarness()
        stepResults.push({
          index,
          type: step.type,
          status: 'passed',
          detail: 'Refreshed the live harness snapshot.',
        })
        continue
      }

      if (step.type === 'clickButtonText') {
        const buttonIndex = findButtonIndexByText(session, step.text)

        if (buttonIndex < 0) {
          throw new Error(`Could not find control matching "${step.text}".`)
        }

        session = await clickHarness({ buttonIndex })
        stepResults.push({
          index,
          type: step.type,
          status: 'passed',
          detail: `Clicked "${step.text}".`,
        })
        continue
      }

      if (step.type === 'clickButtonIndex') {
        session = await clickHarness({ buttonIndex: step.buttonIndex })
        stepResults.push({
          index,
          type: step.type,
          status: 'passed',
          detail: `Clicked control ${step.buttonIndex}.`,
        })
        continue
      }

      if (step.type === 'typeFieldIndex') {
        session = await typeHarness({
          fieldIndex: step.fieldIndex,
          text: step.text,
          clear: step.clear,
        })
        stepResults.push({
          index,
          type: step.type,
          status: 'passed',
          detail: `Typed into field ${step.fieldIndex}.`,
        })
        continue
      }

      if (step.type === 'pressKey') {
        session = await pressHarness({ key: step.key })
        stepResults.push({
          index,
          type: step.type,
          status: 'passed',
          detail: `Pressed ${step.key}.`,
        })
        continue
      }

      if (step.type === 'assertTextPresent') {
        const passed = harnessContainsText(session, step.text)
        passed ? passedAssertions++ : failedAssertions++
        stepResults.push({
          index,
          type: step.type,
          status: passed ? 'passed' : 'failed',
          detail: passed
            ? `Found text "${step.text}".`
            : `Missing text "${step.text}".`,
        })
        failed ||= !passed
        if (!passed) {
          break
        }
        continue
      }

      if (step.type === 'assertButtonPresent') {
        const buttonIndex = findButtonIndexByText(session, step.text)
        const passed = buttonIndex >= 0
        passed ? passedAssertions++ : failedAssertions++
        stepResults.push({
          index,
          type: step.type,
          status: passed ? 'passed' : 'failed',
          detail: passed
            ? `Found control "${step.text}".`
            : `Missing control "${step.text}".`,
        })
        failed ||= !passed
        if (!passed) {
          break
        }
        continue
      }

      if (step.type === 'assertFieldContains') {
        const field = session.fields.find((candidate) => candidate.index === step.fieldIndex)
        const passed = normalizeText(field?.value).includes(normalizeText(step.text))
        passed ? passedAssertions++ : failedAssertions++
        stepResults.push({
          index,
          type: step.type,
          status: passed ? 'passed' : 'failed',
          detail: passed
            ? `Field ${step.fieldIndex} contains "${step.text}".`
            : `Field ${step.fieldIndex} does not contain "${step.text}".`,
        })
        failed ||= !passed
        if (!passed) {
          break
        }
        continue
      }

      if (step.type === 'captureEvidence') {
        session = await refreshHarness()
        const passed = Boolean(session.screenshotDataUrl)
        stepResults.push({
          index,
          type: step.type,
          status: passed ? 'passed' : 'failed',
          detail: passed
            ? `Captured evidence for ${step.label ?? 'scenario step'}.`
            : 'Harness did not return a screenshot.',
        })
        failed ||= !passed
        if (!passed) {
          break
        }
      }
    } catch (error) {
      stepResults.push({
        index,
        type: step.type,
        status: 'failed',
        detail: error instanceof Error ? error.message : 'Scenario step failed.',
      })
      failed = true
      break
    }
  }

  const scenarioExecution = {
    id: scenario.id,
    name: scenario.name,
    target: scenario.target,
    status: failed ? 'failed' : 'passed',
    startedAt,
    completedAt: new Date().toISOString(),
    summary: failed
      ? `Scenario "${scenario.name}" failed.`
      : `Scenario "${scenario.name}" passed.`,
    passedAssertions,
    failedAssertions,
    stepResults,
    screenshotDataUrl: session.screenshotDataUrl ?? null,
    bodyTextExcerpt: session.bodyTextExcerpt ?? '',
  }

  const nextRun = applyExecutionEvidence(run, {
    ...run.execution,
    lastSyncedAt: new Date().toISOString(),
    harness: session,
    scenario: scenarioExecution,
  })

  writeRun(nextRun)
  return nextRun
}
