export type HarnessButton = {
  index: number
  text: string
  ariaLabel: string
  tagName: string
}

export type HarnessField = {
  index: number
  tagName: string
  type: string
  placeholder: string
  ariaLabel: string
  name: string
  value: string
}

export type HarnessSession = {
  id: string
  status: 'attached' | 'failed' | 'stopped'
  attachedAt: string
  lastActionAt: string
  currentUrl: string
  targetUrl: string
  title: string
  interactionCount: number
  buttons: HarnessButton[]
  fields: HarnessField[]
  bodyTextExcerpt: string
  screenshotDataUrl: string | null
  logs: string[]
}

type HarnessPayload = {
  session: HarnessSession | null
  error?: string
}

async function readHarnessPayload(response: Response): Promise<HarnessPayload> {
  const payload = (await response.json()) as HarnessPayload

  if (!response.ok) {
    throw new Error(payload.error ?? 'Harness request failed.')
  }

  return payload
}

export async function fetchHarnessSession() {
  const response = await fetch('/api/harness')
  const payload = await readHarnessPayload(response)
  return payload.session
}

export async function attachHarnessSession(input: { url?: string }) {
  const response = await fetch('/api/harness/attach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readHarnessPayload(response)
  return payload.session
}

export async function refreshHarnessSession() {
  const response = await fetch('/api/harness/refresh', {
    method: 'POST',
  })

  const payload = await readHarnessPayload(response)
  return payload.session
}

export async function clickHarnessControl(input: { buttonIndex: number }) {
  const response = await fetch('/api/harness/click', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readHarnessPayload(response)
  return payload.session
}

export async function typeHarnessField(input: {
  fieldIndex: number
  text: string
  clear?: boolean
}) {
  const response = await fetch('/api/harness/type', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readHarnessPayload(response)
  return payload.session
}

export async function pressHarnessKey(input: { key: string }) {
  const response = await fetch('/api/harness/press', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readHarnessPayload(response)
  return payload.session
}

export async function stopHarnessSession() {
  const response = await fetch('/api/harness/stop', {
    method: 'POST',
  })

  const payload = await readHarnessPayload(response)
  return payload.session
}
