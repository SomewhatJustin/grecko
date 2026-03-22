export type RunnerStatus = 'running' | 'stopped' | 'failed' | 'exited'

export type RunnerSession = {
  id: string
  command: string
  cwd: string
  pid: number | null
  status: RunnerStatus
  startedAt: string
  endedAt: string | null
  exitCode: number | null
  signal: string | null
  logs: string[]
}

type RunnerPayload = {
  session: RunnerSession | null
  error?: string
}

async function readRunnerPayload(response: Response): Promise<RunnerPayload> {
  const payload = (await response.json()) as RunnerPayload

  if (!response.ok) {
    throw new Error(payload.error ?? 'Runner request failed.')
  }

  return payload
}

export async function fetchRunnerSession() {
  const response = await fetch('/api/runner')
  const payload = await readRunnerPayload(response)
  return payload.session
}

export async function startRunnerSession(input: { command: string; cwd: string }) {
  const response = await fetch('/api/runner/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readRunnerPayload(response)
  return payload.session
}

export async function stopRunnerSession() {
  const response = await fetch('/api/runner/stop', {
    method: 'POST',
  })

  const payload = await readRunnerPayload(response)
  return payload.session
}
