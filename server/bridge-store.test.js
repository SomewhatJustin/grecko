import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectBridgeSetup, parseBridgeToolResponse } from './bridge-store.js'

function createTauriFixture({ dependency = false, registration = false }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grecko-bridge-'))
  const srcTauri = path.join(root, 'apps', 'tauri', 'src-tauri', 'src')
  fs.mkdirSync(srcTauri, { recursive: true })

  fs.writeFileSync(
    path.join(root, 'apps', 'tauri', 'src-tauri', 'Cargo.toml'),
    dependency
      ? '[dependencies]\ntauri-plugin-mcp-bridge = "0.10.0"\n'
      : '[dependencies]\ntauri = "2"\n',
  )

  fs.writeFileSync(
    path.join(srcTauri, 'lib.rs'),
    registration
      ? 'fn run() { let _ = tauri_plugin_mcp_bridge::init(); }'
      : 'fn run() {}',
  )

  return root
}

describe('detectBridgeSetup', () => {
  it('reports missing plugin setup cleanly', () => {
    const root = createTauriFixture({})
    const setup = detectBridgeSetup(root)

    expect(setup.setupDetected).toBe(false)
    expect(setup.setupSummary).toMatch(/not installed/i)
  })

  it('detects a fully configured bridge plugin', () => {
    const root = createTauriFixture({ dependency: true, registration: true })
    const setup = detectBridgeSetup(root)

    expect(setup.setupDetected).toBe(true)
    expect(setup.setupSummary).toMatch(/detected/i)
  })
})

describe('parseBridgeToolResponse', () => {
  it('unwraps the CLI JSON envelope', () => {
    const parsed = parseBridgeToolResponse(
      JSON.stringify({
        text: '{"connected":true,"identifier":"9223","host":"127.0.0.1"}',
      }),
    )

    expect(parsed).toEqual({
      connected: true,
      identifier: '9223',
      host: '127.0.0.1',
    })
  })
})
