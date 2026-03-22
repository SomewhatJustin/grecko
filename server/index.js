import http from 'node:http'
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

  sendJson(response, 404, { error: 'Route not found.' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Grecko runner API listening on http://127.0.0.1:${PORT}`)
})
