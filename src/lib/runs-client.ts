export type RunAsset = {
  name: string
  url: string
  kind: string
  source: string
}

export type RunTargetStatus = {
  target: 'linux' | 'android'
  status: 'ready' | 'missing'
  summary: string
  selectedAsset: RunAsset | null
}

export type RunRunnerSession = {
  id: string
  command: string
  cwd: string
  pid: number | null
  status: 'running' | 'stopped' | 'failed' | 'exited'
  startedAt: string
  endedAt: string | null
  exitCode: number | null
  signal: string | null
  logs: string[]
}

export type RunBridgeSession = {
  cwd: string
  port: number
  command: string
  status: 'idle' | 'ready' | 'stopped' | 'failed' | 'unavailable'
  connected: boolean
  setupDetected: boolean
  setupSummary: string
  app: string | null
  identifier: string | null
  host: string | null
  logs: string[]
}

export type RunHarnessButton = {
  index: number
  text: string
  ariaLabel: string
  tagName: string
}

export type RunHarnessField = {
  index: number
  tagName: string
  type: string
  placeholder: string
  ariaLabel: string
  name: string
  value: string
}

export type RunHarnessSession = {
  id: string
  mode?: 'browser' | 'android'
  status: 'attached' | 'failed' | 'stopped'
  attachedAt: string
  lastActionAt: string
  currentUrl: string
  targetUrl: string
  title: string
  interactionCount: number
  buttons: RunHarnessButton[]
  fields: RunHarnessField[]
  bodyTextExcerpt: string
  screenshotDataUrl: string | null
  logs: string[]
  deviceSerial?: string
  packageName?: string
}

export type RunAndroidExecution = {
  serial: string
  packageName: string
  activityName: string
  status: 'running' | 'stopped' | 'failed' | 'completed'
  installedApkPath: string
  installOutput: string
  launchedAt: string
  checkedAt: string
  pid: string | null
  focused: boolean
  logs: string[]
}

export type RunRecord = {
  id: string
  createdAt: string
  status: string
  releaseUrl: string
  provider: string
  release: {
    provider: string
    host: string
    projectPath: string
    repositoryUrl: string
    releasePageUrl: string
    releaseName: string
    tagName: string
    publishedAt: string
    notesExcerpt: string
    assets: RunAsset[]
    selectedAssets: {
      linux: RunAsset | null
      android: RunAsset | null
    }
    targetStatuses: RunTargetStatus[]
  }
  verdict: {
    label: 'ship' | 'investigate' | 'block'
    reasonCodes: string[]
    summary: string
  }
  baseline: {
    status: string
    summary: string
  }
  stages: {
    intake: string
    launch: string
    harness: string
    bridge: string
  }
  execution: {
    target?: 'desktop' | 'android'
    command: string
    cwd: string
    port: number
    startedAt: string
    lastSyncedAt: string
    runner: RunRunnerSession | null
    android?: RunAndroidExecution | null
    harness: RunHarnessSession | null
    bridge: RunBridgeSession | null
  } | null
}

type RunsPayload = {
  runs?: RunRecord[]
  run?: RunRecord
  error?: string
}

async function readRunsPayload(response: Response): Promise<RunsPayload> {
  const payload = (await response.json()) as RunsPayload

  if (!response.ok) {
    throw new Error(payload.error ?? 'Run request failed.')
  }

  return payload
}

export async function fetchRuns() {
  const response = await fetch('/api/runs')
  const payload = await readRunsPayload(response)
  return payload.runs ?? []
}

export async function createRun(input: { releaseUrl: string }) {
  const response = await fetch('/api/runs/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readRunsPayload(response)
  return payload.run
}

export async function executeRun(input: {
  runId: string
  command?: string
  cwd?: string
  port?: number
  target?: 'desktop' | 'android'
  serial?: string
  packageName?: string
  activityName?: string
}) {
  const response = await fetch('/api/runs/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readRunsPayload(response)
  return payload.run
}

export async function syncRun(input: { runId: string }) {
  const response = await fetch('/api/runs/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readRunsPayload(response)
  return payload.run
}
