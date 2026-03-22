import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getRunnerSession,
  resetRunnerStateForTests,
  startRunner,
  stopRunner,
  validateLaunchRequest,
} from './runner-store.js'

function processExists(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitFor(check, timeoutMs = 3_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const value = check()
    if (value) {
      return value
    }

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error('Timed out waiting for runner state.')
}

afterEach(() => {
  resetRunnerStateForTests()
})

describe('validateLaunchRequest', () => {
  it('rejects empty commands', () => {
    expect(() => validateLaunchRequest({ command: '   ', cwd: '' })).toThrow(
      /exact command/i,
    )
  })

  it('resolves working directories to absolute paths', () => {
    const launch = validateLaunchRequest({ command: 'pwd', cwd: '.' })

    expect(launch.cwd).toBe(path.resolve('.'))
  })
})

describe('startRunner', () => {
  it('captures output from a short-lived process', async () => {
    startRunner({
      command: 'node -e "console.log(`runner-ok`)"',
      cwd: '.',
    })

    const completedSession = await waitFor(() => {
      const session = getRunnerSession()
      return session?.status === 'exited' ? session : null
    })

    expect(completedSession.logs.join('\n')).toContain('runner-ok')
  })

  it('stops a running process', async () => {
    startRunner({
      command: 'node -e "setInterval(() => console.log(`tick`), 100)"',
      cwd: '.',
    })

    stopRunner()

    const stoppedSession = await waitFor(() => {
      const session = getRunnerSession()
      return session?.status === 'stopped' ? session : null
    })

    expect(stoppedSession.signal).toMatch(/SIGTERM|SIGKILL/)
  })

  it('kills descendant processes when stopping a runner', async () => {
    startRunner({
      command:
        `sh -c 'node -e "setInterval(() => {}, 10000)" & echo child:$!; wait'`,
      cwd: '.',
    })

    const childPid = await waitFor(() => {
      const session = getRunnerSession()
      const match = session?.logs.join('\n').match(/child:(\d+)/)
      return match ? Number(match[1]) : null
    })

    expect(processExists(childPid)).toBe(true)

    stopRunner()

    await waitFor(() => {
      const session = getRunnerSession()
      return session?.status === 'stopped' ? session : null
    })

    await waitFor(() => (processExists(childPid) ? null : true))
    expect(processExists(childPid)).toBe(false)
  })
})
