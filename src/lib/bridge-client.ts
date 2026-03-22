export type BridgeStatus =
  | 'idle'
  | 'ready'
  | 'stopped'
  | 'failed'
  | 'unavailable'

export type BridgeSession = {
  cwd: string
  port: number
  command: string
  status: BridgeStatus
  connected: boolean
  setupDetected: boolean
  setupSummary: string
  app: string | null
  identifier: string | null
  host: string | null
  logs: string[]
}

type BridgePayload = {
  session: BridgeSession | null
  error?: string
}

async function readBridgePayload(response: Response): Promise<BridgePayload> {
  const payload = (await response.json()) as BridgePayload

  if (!response.ok) {
    throw new Error(payload.error ?? 'Bridge request failed.')
  }

  return payload
}

export async function fetchBridgeSession() {
  const response = await fetch('/api/bridge')
  const payload = await readBridgePayload(response)
  return payload.session
}

export async function checkBridgeSession(input: { cwd: string; port: number }) {
  const response = await fetch('/api/bridge/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readBridgePayload(response)
  return payload.session
}

export async function startBridgeSession(input: { cwd: string; port: number }) {
  const response = await fetch('/api/bridge/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readBridgePayload(response)
  return payload.session
}

export async function stopBridgeSession() {
  const response = await fetch('/api/bridge/stop', {
    method: 'POST',
  })

  const payload = await readBridgePayload(response)
  return payload.session
}
