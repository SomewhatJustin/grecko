import { describe, expect, it } from 'vitest'
import {
  getScenarioDefinition,
  listScenarios,
  validateScenarioDefinition,
} from './scenario-store.js'

describe('scenario-store', () => {
  it('lists the seeded scenario catalog', () => {
    const scenarios = listScenarios()

    expect(scenarios.length).toBeGreaterThan(1)
    expect(scenarios.some((scenario) => scenario.target === 'android')).toBe(true)
    expect(scenarios.some((scenario) => scenario.target === 'browser')).toBe(true)
  })

  it('resolves a known scenario definition', () => {
    const scenario = getScenarioDefinition('stonefruit-android-quick-capture')

    expect(scenario?.name).toMatch(/Quick Capture/i)
    expect(scenario?.steps.length).toBeGreaterThan(3)
  })

  it('rejects an invalid scenario definition', () => {
    expect(() =>
      validateScenarioDefinition({
        id: 'broken',
        name: 'Broken',
        target: 'android',
        steps: [{ type: 'assertTextPresent' }],
      }),
    ).toThrow(/must provide text/i)
  })
})
