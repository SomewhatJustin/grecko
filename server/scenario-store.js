const defaultScenarios = [
  {
    id: 'stonefruit-android-quick-capture',
    name: 'Stonefruit Android Quick Capture',
    target: 'android',
    description:
      'Open Quick capture, write a note, and assert the title and body are visible in the editor.',
    steps: [
      { type: 'refreshHarness' },
      { type: 'clickButtonText', text: 'Quick capture' },
      { type: 'typeFieldIndex', fieldIndex: 0, text: 'Grecko Scenario Note', clear: true },
      {
        type: 'typeFieldIndex',
        fieldIndex: 1,
        text: 'Scenario body recorded by Grecko',
        clear: true,
      },
      { type: 'assertFieldContains', fieldIndex: 0, text: 'Grecko Scenario Note' },
      { type: 'assertTextPresent', text: 'Scenario body recorded by Grecko' },
      { type: 'captureEvidence', label: 'android note editor' },
    ],
  },
  {
    id: 'stonefruit-browser-new-note',
    name: 'Stonefruit Browser New Note',
    target: 'browser',
    description:
      'Open a new note in the browser harness, write content, and assert the draft is visible.',
    steps: [
      { type: 'refreshHarness' },
      { type: 'clickButtonText', text: 'New' },
      { type: 'typeFieldIndex', fieldIndex: 0, text: 'Grecko Browser Note', clear: true },
      {
        type: 'typeFieldIndex',
        fieldIndex: 1,
        text: 'Browser scenario body recorded by Grecko',
        clear: true,
      },
      { type: 'assertFieldContains', fieldIndex: 0, text: 'Grecko Browser Note' },
      { type: 'assertTextPresent', text: 'Browser scenario body recorded by Grecko' },
      { type: 'captureEvidence', label: 'browser note editor' },
    ],
  },
]

function validateScenarioStep(step, index) {
  if (!step || typeof step !== 'object') {
    throw new Error(`Scenario step ${index + 1} must be an object.`)
  }

  const allowedTypes = new Set([
    'refreshHarness',
    'clickButtonText',
    'clickButtonIndex',
    'typeFieldIndex',
    'pressKey',
    'assertTextPresent',
    'assertButtonPresent',
    'assertFieldContains',
    'captureEvidence',
  ])

  if (!allowedTypes.has(step.type)) {
    throw new Error(`Scenario step ${index + 1} uses unsupported type "${step.type}".`)
  }

  if (
    (step.type === 'clickButtonText' ||
      step.type === 'assertTextPresent' ||
      step.type === 'assertButtonPresent' ||
      step.type === 'assertFieldContains') &&
    typeof step.text !== 'string'
  ) {
    throw new Error(`Scenario step ${index + 1} must provide text.`)
  }

  if (step.type === 'clickButtonIndex' && typeof step.buttonIndex !== 'number') {
    throw new Error(`Scenario step ${index + 1} must provide a button index.`)
  }

  if (
    (step.type === 'typeFieldIndex' || step.type === 'assertFieldContains') &&
    typeof step.fieldIndex !== 'number'
  ) {
    throw new Error(`Scenario step ${index + 1} must provide a field index.`)
  }

  if (step.type === 'pressKey' && typeof step.key !== 'string') {
    throw new Error(`Scenario step ${index + 1} must provide a key.`)
  }
}

export function validateScenarioDefinition(scenario) {
  if (!scenario || typeof scenario !== 'object') {
    throw new Error('Scenario definition is required.')
  }

  if (typeof scenario.id !== 'string' || !scenario.id.trim()) {
    throw new Error('Scenario id is required.')
  }

  if (typeof scenario.name !== 'string' || !scenario.name.trim()) {
    throw new Error('Scenario name is required.')
  }

  if (scenario.target !== 'android' && scenario.target !== 'browser') {
    throw new Error(`Scenario "${scenario.id}" must target android or browser.`)
  }

  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
    throw new Error(`Scenario "${scenario.id}" must include at least one step.`)
  }

  scenario.steps.forEach(validateScenarioStep)
}

defaultScenarios.forEach(validateScenarioDefinition)

export function listScenarios() {
  return defaultScenarios
}

export function getScenarioDefinition(scenarioId) {
  return defaultScenarios.find((scenario) => scenario.id === scenarioId) ?? null
}
