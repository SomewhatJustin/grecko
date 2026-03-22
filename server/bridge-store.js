import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { validateLaunchRequest } from './runner-store.js'

const DEFAULT_BRIDGE_PORT = 9223

let currentBridgeSession = null

function readFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return fs.readFileSync(filePath, 'utf8')
}

function findTauriProject(cwd) {
  const candidates = [
    {
      root: cwd,
      cargo: path.join(cwd, 'src-tauri', 'Cargo.toml'),
      rust: path.join(cwd, 'src-tauri', 'src', 'lib.rs'),
    },
    {
      root: path.join(cwd, 'apps', 'tauri'),
      cargo: path.join(cwd, 'apps', 'tauri', 'src-tauri', 'Cargo.toml'),
      rust: path.join(cwd, 'apps', 'tauri', 'src-tauri', 'src', 'lib.rs'),
    },
  ]

  return candidates.find((candidate) => fs.existsSync(candidate.cargo)) ?? null
}

export function detectBridgeSetup(cwd) {
  const project = findTauriProject(cwd)

  if (!project) {
    return {
      tauriProjectRoot: null,
      setupDetected: false,
      setupSummary: 'No Tauri project was found under this directory.',
    }
  }

  const cargoToml = readFileIfPresent(project.cargo) ?? ''
  const rustSetup = readFileIfPresent(project.rust) ?? ''
  const hasDependency = cargoToml.includes('tauri-plugin-mcp-bridge')
  const hasRegistration = rustSetup.includes('tauri_plugin_mcp_bridge')

  if (hasDependency && hasRegistration) {
    return {
      tauriProjectRoot: project.root,
      setupDetected: true,
      setupSummary: 'Tauri MCP bridge plugin detected in Cargo and Rust setup.',
    }
  }

  if (hasDependency) {
    return {
      tauriProjectRoot: project.root,
      setupDetected: false,
      setupSummary:
        'Bridge dependency exists, but the Rust app setup does not register the MCP bridge plugin yet.',
    }
  }

  return {
    tauriProjectRoot: project.root,
    setupDetected: false,
    setupSummary:
      'Tauri MCP bridge plugin is not installed in this project yet. Stonefruit currently matches this state.',
  }
}

function resolveBridgeCli() {
  const globalCommand = spawnSync('tauri-mcp', ['--help'], {
    encoding: 'utf8',
    stdio: 'pipe',
  })

  if (globalCommand.status === 0) {
    return {
      command: 'tauri-mcp',
      argsPrefix: [],
      printable: 'tauri-mcp',
    }
  }

  return {
    command: 'npx',
    argsPrefix: ['-y', '--package', '@hypothesi/tauri-mcp-cli', 'tauri-mcp'],
    printable: 'npx -y --package @hypothesi/tauri-mcp-cli tauri-mcp',
  }
}

function runBridgeCli(args, cwd) {
  const cli = resolveBridgeCli()
  const result = spawnSync(cli.command, [...cli.argsPrefix, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })

  return {
    ...result,
    printableCommand: `${cli.printable} ${args.join(' ')}`.trim(),
  }
}

export function parseBridgeToolResponse(stdout) {
  const envelope = JSON.parse(stdout)
  const nested = envelope.text ?? envelope.content?.[0]?.text ?? '{}'
  return JSON.parse(nested)
}

function buildBridgeSession(base) {
  return {
    cwd: base.cwd,
    port: base.port,
    command: base.command,
    status: base.status,
    connected: base.connected,
    setupDetected: base.setupDetected,
    setupSummary: base.setupSummary,
    app: base.app ?? null,
    identifier: base.identifier ?? null,
    host: base.host ?? null,
    logs: base.logs ?? [],
  }
}

export function getBridgeSession() {
  return currentBridgeSession
}

export function checkBridge(payload) {
  const { cwd } = validateLaunchRequest({
    command: payload?.command ?? 'echo bridge-check',
    cwd: payload?.cwd,
  })
  const port = Number(payload?.port ?? DEFAULT_BRIDGE_PORT)
  const setup = detectBridgeSetup(cwd)
  const statusResult = runBridgeCli(['driver-session', 'status', '--json'], cwd)
  const logs = [
    `[system] ${statusResult.printableCommand}`,
    ...statusResult.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => `[stdout] ${line}`),
    ...statusResult.stderr
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => `[stderr] ${line}`),
  ]

  const parsedStatus = parseBridgeToolResponse(statusResult.stdout)
  const status = setup.setupDetected
    ? parsedStatus.connected
      ? 'ready'
      : 'idle'
    : 'unavailable'

  currentBridgeSession = buildBridgeSession({
    cwd,
    port,
    command: statusResult.printableCommand,
    status,
    connected: Boolean(parsedStatus.connected),
    setupDetected: setup.setupDetected,
    setupSummary: setup.setupSummary,
    app: parsedStatus.app,
    identifier: parsedStatus.identifier,
    host: parsedStatus.host,
    logs,
  })

  return currentBridgeSession
}

export function startBridge(payload) {
  const bridgeSession = checkBridge(payload)

  if (!bridgeSession.setupDetected) {
    throw new Error(bridgeSession.setupSummary)
  }

  const startResult = runBridgeCli(
    ['driver-session', 'start', '--port', String(bridgeSession.port)],
    bridgeSession.cwd,
  )

  if (startResult.status !== 0) {
    currentBridgeSession = buildBridgeSession({
      ...bridgeSession,
      status: 'failed',
      logs: [
        `[system] ${startResult.printableCommand}`,
        ...startResult.stdout
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => `[stdout] ${line}`),
        ...startResult.stderr
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => `[stderr] ${line}`),
      ],
    })
    throw new Error('Tauri MCP bridge session failed to start.')
  }

  const refreshed = checkBridge({
    cwd: bridgeSession.cwd,
    port: bridgeSession.port,
  })

  currentBridgeSession = {
    ...refreshed,
    logs: [
      `[system] ${startResult.printableCommand}`,
      ...startResult.stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => `[stdout] ${line}`),
      ...startResult.stderr
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => `[stderr] ${line}`),
      ...refreshed.logs,
    ],
  }

  return currentBridgeSession
}

export function stopBridge() {
  const bridgeSession = currentBridgeSession

  if (!bridgeSession) {
    return null
  }

  const stopResult = runBridgeCli(['driver-session', 'stop'], bridgeSession.cwd)
  const refreshed = checkBridge({
    cwd: bridgeSession.cwd,
    port: bridgeSession.port,
  })

  currentBridgeSession = {
    ...refreshed,
    status: refreshed.connected ? 'ready' : 'stopped',
    logs: [
      `[system] ${stopResult.printableCommand}`,
      ...stopResult.stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => `[stdout] ${line}`),
      ...stopResult.stderr
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => `[stderr] ${line}`),
      ...refreshed.logs,
    ],
  }

  return currentBridgeSession
}
