export type ScenarioStep = {
  type: string
  text?: string
  fieldIndex?: number
  buttonIndex?: number
  key?: string
  clear?: boolean
  label?: string
}

export type ScenarioDefinition = {
  id: string
  name: string
  target: 'android' | 'browser'
  description: string
  steps: ScenarioStep[]
}

type ScenariosPayload = {
  scenarios?: ScenarioDefinition[]
  error?: string
}

async function readScenariosPayload(response: Response): Promise<ScenariosPayload> {
  const payload = (await response.json()) as ScenariosPayload

  if (!response.ok) {
    throw new Error(payload.error ?? 'Scenario request failed.')
  }

  return payload
}

export async function fetchScenarios() {
  const response = await fetch('/api/scenarios')
  const payload = await readScenariosPayload(response)
  return payload.scenarios ?? []
}
