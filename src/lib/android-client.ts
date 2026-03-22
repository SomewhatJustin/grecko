export type AndroidDevice = {
  serial: string
  state: string
  model: string | null
  product: string | null
  transportId: string | null
  isEmulator: boolean
}

type AndroidDevicesPayload = {
  devices?: AndroidDevice[]
  error?: string
}

type AndroidActionPayload<T> = {
  install?: T
  launch?: T
  error?: string
}

async function readDevicesPayload(response: Response): Promise<AndroidDevicesPayload> {
  const payload = (await response.json()) as AndroidDevicesPayload

  if (!response.ok) {
    throw new Error(payload.error ?? 'Android request failed.')
  }

  return payload
}

async function readActionPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as AndroidActionPayload<T>

  if (!response.ok) {
    throw new Error(payload.error ?? 'Android request failed.')
  }

  return (payload.install ?? payload.launch) as T
}

export async function fetchAndroidDevices() {
  const response = await fetch('/api/android/devices')
  const payload = await readDevicesPayload(response)
  return payload.devices ?? []
}

export async function installAndroidRelease(input: {
  serial: string
  apkUrl?: string
  apkPath?: string
}) {
  const response = await fetch('/api/android/install', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  return readActionPayload<{
    serial: string
    apkPath: string
    output: string
  }>(response)
}

export async function launchAndroidTarget(input: {
  serial: string
  packageName?: string
  activityName?: string
}) {
  const response = await fetch('/api/android/launch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  return readActionPayload<{
    serial: string
    packageName: string
    activityName: string
  }>(response)
}

export async function stopAndroidTarget(input: {
  serial: string
  packageName?: string
}) {
  const response = await fetch('/api/android/stop', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  return readActionPayload<{
    serial: string
    packageName: string
  }>(response)
}
