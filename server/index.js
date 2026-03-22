import http from 'node:http'
import { checkBridge, getBridgeSession, startBridge, stopBridge } from './bridge-store.js'
import {
  attachHarness,
  clickHarness,
  getHarnessSession,
  pressHarness,
  refreshHarness,
  stopHarness,
  typeHarness,
} from './harness-store.js'
import { createRun, executeRun, listRuns, syncRunExecution } from './runs-store.js'
import { getRunnerSession, startRunner, stopRunner } from './runner-store.js'

const PORT = Number(process.env.GRECKO_API_PORT ?? 4174)

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  response.end(JSON.stringify(payload))
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })

    request.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Request body must be valid JSON.'))
      }
    })

    request.on('error', reject)
  })
}

const server = http.createServer(async (request, response) => {
  if (!request.url || !request.method) {
    sendJson(response, 400, { error: 'Malformed request.' })
    return
  }

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  if (request.url === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.url === '/api/runner' && request.method === 'GET') {
    sendJson(response, 200, { session: getRunnerSession() })
    return
  }

  if (request.url === '/api/runner/start' && request.method === 'POST') {
    try {
      const payload = await readJson(request)
      sendJson(response, 200, { session: startRunner(payload) })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not start app.',
      })
    }
    return
  }

  if (request.url === '/api/runner/stop' && request.method === 'POST') {
    sendJson(response, 200, { session: stopRunner() })
    return
  }

  if (request.url === '/api/runs' && request.method === 'GET') {
    sendJson(response, 200, { runs: listRuns() })
    return
  }

  if (request.url === '/api/runs/start' && request.method === 'POST') {
    try {
      const payload = await readJson(request)
      sendJson(response, 200, { run: await createRun(payload) })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not create run.',
      })
    }
    return
  }

  if (request.url === '/api/runs/execute' && request.method === 'POST') {
    try {
      const payload = await readJson(request)
      sendJson(response, 200, { run: await executeRun(payload) })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not execute run.',
      })
    }
    return
  }

  if (request.url === '/api/runs/sync' && request.method === 'POST') {
    try {
      const payload = await readJson(request)
      sendJson(response, 200, { run: syncRunExecution(payload) })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not sync run execution.',
      })
    }
    return
  }

  if (request.url === '/api/harness' && request.method === 'GET') {
    sendJson(response, 200, { session: getHarnessSession() })
    return
  }

  if (request.url === '/api/harness/attach' && request.method === 'POST') {
    try {
      const payload = await readJson(request)
      sendJson(response, 200, { session: await attachHarness(payload) })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not attach browser harness.',
      })
    }
    return
  }

  if (request.url === '/api/harness/refresh' && request.method === 'POST') {
    try {
      sendJson(response, 200, { session: await refreshHarness() })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not refresh browser harness.',
      })
    }
    return
  }

  if (request.url === '/api/harness/click' && request.method === 'POST') {
    try {
      const payload = await readJson(request)
      sendJson(response, 200, { session: await clickHarness(payload) })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not click app control.',
      })
    }
    return
  }

  if (request.url === '/api/harness/type' && request.method === 'POST') {
    try {
      const payload = await readJson(request)
      sendJson(response, 200, { session: await typeHarness(payload) })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not type into app field.',
      })
    }
    return
  }

  if (request.url === '/api/harness/press' && request.method === 'POST') {
    try {
      const payload = await readJson(request)
      sendJson(response, 200, { session: await pressHarness(payload) })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not send key to app.',
      })
    }
    return
  }

  if (request.url === '/api/harness/stop' && request.method === 'POST') {
    try {
      sendJson(response, 200, { session: await stopHarness() })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not stop browser harness.',
      })
    }
    return
  }

  if (request.url === '/api/bridge' && request.method === 'GET') {
    sendJson(response, 200, { session: getBridgeSession() })
    return
  }

  if (request.url === '/api/bridge/check' && request.method === 'POST') {
    try {
      const payload = await readJson(request)
      sendJson(response, 200, { session: checkBridge(payload) })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not inspect bridge setup.',
      })
    }
    return
  }

  if (request.url === '/api/bridge/start' && request.method === 'POST') {
    try {
      const payload = await readJson(request)
      sendJson(response, 200, { session: startBridge(payload) })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not start bridge session.',
      })
    }
    return
  }

  if (request.url === '/api/bridge/stop' && request.method === 'POST') {
    try {
      sendJson(response, 200, { session: stopBridge() })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Could not stop bridge session.',
      })
    }
    return
  }

  sendJson(response, 404, { error: 'Route not found.' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Grecko runner API listening on http://127.0.0.1:${PORT}`)
})
