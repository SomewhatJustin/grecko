import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const LOG_LIMIT = 120

let currentSession = null
let nextSessionId = 1

function appendLog(session, stream, message) {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)

  if (lines.length === 0) {
    return
  }

  for (const line of lines) {
    session.logs.push(`[${stream}] ${line}`)
  }

  if (session.logs.length > LOG_LIMIT) {
    session.logs.splice(0, session.logs.length - LOG_LIMIT)
  }
}

function serializeSession(session) {
  if (!session) {
    return null
  }

  return {
    id: session.id,
    command: session.command,
    cwd: session.cwd,
    pid: session.pid,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    exitCode: session.exitCode,
    signal: session.signal,
    logs: [...session.logs],
  }
}

export function validateLaunchRequest(payload) {
  const command = payload?.command?.trim()
  const cwdInput = payload?.cwd?.trim()

  if (!command) {
    throw new Error('Enter the exact command Grecko should run for the target app.')
  }

  const cwd = cwdInput ? path.resolve(cwdInput) : process.cwd()

  if (!fs.existsSync(cwd)) {
    throw new Error(`Working directory does not exist: ${cwd}`)
  }

  if (!fs.statSync(cwd).isDirectory()) {
    throw new Error(`Working directory is not a folder: ${cwd}`)
  }

  return {
    command,
    cwd,
  }
}

export function getRunnerSession() {
  return serializeSession(currentSession)
}

export function startRunner(payload) {
  const { command, cwd } = validateLaunchRequest(payload)

  if (currentSession?.status === 'running') {
    throw new Error('A Grecko runner session is already active. Stop it first.')
  }

  const child = spawn('bash', ['-lc', command], {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const session = {
    id: String(nextSessionId++),
    child,
    command,
    cwd,
    pid: child.pid ?? null,
    status: 'running',
    startedAt: new Date().toISOString(),
    endedAt: null,
    exitCode: null,
    signal: null,
    logs: [],
  }

  appendLog(session, 'system', `Launching command: ${command}`)
  currentSession = session

  child.stdout.on('data', (chunk) => {
    appendLog(session, 'stdout', String(chunk))
  })

  child.stderr.on('data', (chunk) => {
    appendLog(session, 'stderr', String(chunk))
  })

  child.on('error', (error) => {
    session.status = 'failed'
    session.endedAt = new Date().toISOString()
    session.exitCode = 1
    appendLog(session, 'system', `Launch failed: ${error.message}`)
  })

  child.on('close', (code, signal) => {
    session.signal = signal
    session.endedAt = new Date().toISOString()
    session.exitCode = typeof code === 'number' ? code : null

    if (signal) {
      session.status = 'stopped'
      appendLog(session, 'system', `Process stopped with signal ${signal}.`)
      return
    }

    session.status = code === 0 ? 'exited' : 'failed'
    appendLog(
      session,
      'system',
      `Process exited with code ${typeof code === 'number' ? code : 'unknown'}.`,
    )
  })

  return serializeSession(session)
}

export function stopRunner() {
  if (!currentSession) {
    return null
  }

  if (currentSession.status !== 'running') {
    return serializeSession(currentSession)
  }

  appendLog(currentSession, 'system', 'Stopping process with SIGTERM.')
  currentSession.child.kill('SIGTERM')

  setTimeout(() => {
    if (currentSession?.status === 'running') {
      appendLog(currentSession, 'system', 'Escalating stop to SIGKILL.')
      currentSession.child.kill('SIGKILL')
    }
  }, 2_000).unref()

  return serializeSession(currentSession)
}

export function resetRunnerStateForTests() {
  if (currentSession?.status === 'running') {
    currentSession.child.kill('SIGKILL')
  }

  currentSession = null
  nextSessionId = 1
}
