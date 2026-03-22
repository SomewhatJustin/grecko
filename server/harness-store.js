import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { getRunnerSession } from './runner-store.js'

const LOG_LIMIT = 80
const BUTTON_SELECTOR = 'button, [role="button"], a'
const FIELD_SELECTOR =
  'input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'
const DEFAULT_VIEWPORT = {
  width: 1440,
  height: 960,
  deviceScaleFactor: 1,
}
const COMMON_BROWSER_PATHS = [
  process.env.GRECKO_BROWSER_BINARY,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

let currentHarnessSession = null

function appendLog(session, stream, message) {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
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

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function serializeHarnessSession(session) {
  if (!session) {
    return null
  }

  return {
    id: session.id,
    status: session.status,
    attachedAt: session.attachedAt,
    lastActionAt: session.lastActionAt,
    currentUrl: session.currentUrl,
    targetUrl: session.targetUrl,
    title: session.title,
    interactionCount: session.interactionCount,
    buttons: session.buttons,
    fields: session.fields,
    bodyTextExcerpt: session.bodyTextExcerpt,
    screenshotDataUrl: session.screenshotDataUrl,
    logs: [...session.logs],
  }
}

function resolveBrowserBinary() {
  for (const candidate of COMMON_BROWSER_PATHS) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }

  const which = spawnSync('bash', ['-lc', 'which google-chrome-stable google-chrome chromium chromium-browser 2>/dev/null | head -n 1'], {
    encoding: 'utf8',
    stdio: 'pipe',
  })
  const binary = which.stdout.trim()

  if (binary) {
    return binary
  }

  throw new Error(
    'Grecko could not find a Chrome-compatible browser binary for the no-integration harness.',
  )
}

export function extractLocalUrls(text) {
  return [
    ...new Set(
      (text.match(
        /https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/[^\s'"`<>)]*)?/g,
      ) ?? []),
    ),
  ]
}

export function detectHarnessTargetUrl(session = getRunnerSession()) {
  if (!session?.logs?.length) {
    return null
  }

  const urls = extractLocalUrls(session.logs.join('\n'))
  return urls[0] ?? null
}

async function captureSnapshot(page, includeScreenshot) {
  const snapshot = await page.evaluate(
    ({ buttonSelector, fieldSelector }) => {
      function toText(node) {
        return (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
      }

      function summarizeButtons() {
        return Array.from(document.querySelectorAll(buttonSelector))
          .map((node, index) => ({
            index,
            text: toText(node) || node.getAttribute('aria-label') || node.getAttribute('title') || `control-${index + 1}`,
            ariaLabel: node.getAttribute('aria-label') || '',
            tagName: node.tagName.toLowerCase(),
          }))
          .filter((button) => button.text)
          .slice(0, 16)
      }

      function summarizeFields() {
        return Array.from(document.querySelectorAll(fieldSelector))
          .map((node, index) => ({
            index,
            tagName: node.tagName.toLowerCase(),
            type: node.getAttribute('type') || '',
            placeholder: node.getAttribute('placeholder') || '',
            ariaLabel: node.getAttribute('aria-label') || '',
            name: node.getAttribute('name') || '',
            value:
              node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
                ? node.value
                : node.textContent || '',
          }))
          .slice(0, 12)
      }

      return {
        currentUrl: window.location.href,
        title: document.title,
        bodyTextExcerpt: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 700),
        buttons: summarizeButtons(),
        fields: summarizeFields(),
      }
    },
    {
      buttonSelector: BUTTON_SELECTOR,
      fieldSelector: FIELD_SELECTOR,
    },
  )

  let screenshotDataUrl = null

  if (includeScreenshot) {
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64',
      fullPage: true,
    })
    screenshotDataUrl = `data:image/png;base64,${screenshot}`
  }

  return {
    ...snapshot,
    screenshotDataUrl,
  }
}

function applySnapshot(session, snapshot) {
  session.currentUrl = snapshot.currentUrl
  session.title = snapshot.title
  session.bodyTextExcerpt = snapshot.bodyTextExcerpt
  session.buttons = snapshot.buttons
  session.fields = snapshot.fields

  if (snapshot.screenshotDataUrl) {
    session.screenshotDataUrl = snapshot.screenshotDataUrl
  }
}

async function updateHarnessSnapshot(session, includeScreenshot = false) {
  const snapshot = await captureSnapshot(session.page, includeScreenshot)
  applySnapshot(session, snapshot)
  session.lastActionAt = new Date().toISOString()
  return serializeHarnessSession(session)
}

async function closeHarnessBrowser() {
  if (!currentHarnessSession?.browser) {
    currentHarnessSession = null
    return
  }

  try {
    await currentHarnessSession.browser.close()
  } catch {
    // Best effort cleanup for dev use.
  }

  currentHarnessSession = null
}

export function getHarnessSession() {
  return serializeHarnessSession(currentHarnessSession)
}

export async function attachHarness(payload = {}) {
  const targetUrl = payload.url?.trim() || detectHarnessTargetUrl()

  if (!targetUrl) {
    throw new Error(
      'Grecko could not detect a local app URL from the runner logs yet. Launch the app first or provide a URL.',
    )
  }

  await closeHarnessBrowser()

  const browser = await puppeteer.launch({
    executablePath: resolveBrowserBinary(),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: DEFAULT_VIEWPORT,
  })
  const page = await browser.newPage()

  const session = {
    id: String(Date.now()),
    browser,
    page,
    status: 'attached',
    attachedAt: new Date().toISOString(),
    lastActionAt: new Date().toISOString(),
    targetUrl,
    currentUrl: targetUrl,
    title: '',
    interactionCount: 0,
    buttons: [],
    fields: [],
    bodyTextExcerpt: '',
    screenshotDataUrl: null,
    logs: [],
  }

  page.on('console', (message) => {
    appendLog(session, 'console', message.text())
  })
  page.on('pageerror', (error) => {
    appendLog(session, 'pageerror', error.message)
  })
  page.on('requestfailed', (request) => {
    appendLog(session, 'requestfailed', `${request.failure()?.errorText ?? 'Request failed'} ${request.url()}`)
  })

  currentHarnessSession = session
  appendLog(session, 'system', `Launching no-integration browser harness for ${targetUrl}`)

  try {
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    })
    await wait(1_500)
    await updateHarnessSnapshot(session, true)
  } catch (error) {
    session.status = 'failed'
    appendLog(
      session,
      'system',
      error instanceof Error ? error.message : 'Harness attach failed.',
    )
    throw new Error(
      error instanceof Error
        ? `Grecko could not attach the browser harness: ${error.message}`
        : 'Grecko could not attach the browser harness.',
    )
  }

  return serializeHarnessSession(session)
}

export async function refreshHarness() {
  if (!currentHarnessSession?.page) {
    return null
  }

  return updateHarnessSnapshot(currentHarnessSession, true)
}

export async function clickHarness(payload = {}) {
  if (!currentHarnessSession?.page) {
    throw new Error('No browser harness session is active.')
  }

  const buttonIndex = Number(payload.buttonIndex)

  if (!Number.isInteger(buttonIndex)) {
    throw new Error('Choose a valid button from the discovered app controls.')
  }

  const clicked = await currentHarnessSession.page.evaluate(
    ({ buttonSelector, buttonIndex }) => {
      const controls = Array.from(document.querySelectorAll(buttonSelector))
      const element = controls[buttonIndex]

      if (!(element instanceof HTMLElement)) {
        return null
      }

      const text =
        element.textContent?.replace(/\s+/g, ' ').trim() ||
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        `control-${buttonIndex + 1}`

      element.click()
      return text
    },
    {
      buttonSelector: BUTTON_SELECTOR,
      buttonIndex,
    },
  )

  if (!clicked) {
    throw new Error('Grecko could not click that control in the browser harness.')
  }

  currentHarnessSession.interactionCount += 1
  appendLog(currentHarnessSession, 'system', `Clicked control: ${clicked}`)
  await wait(700)
  return updateHarnessSnapshot(currentHarnessSession, true)
}

export async function typeHarness(payload = {}) {
  if (!currentHarnessSession?.page) {
    throw new Error('No browser harness session is active.')
  }

  const fieldIndex = Number(payload.fieldIndex)
  const text = payload.text ?? ''
  const clear = payload.clear !== false

  if (!Number.isInteger(fieldIndex)) {
    throw new Error('Choose a valid field from the discovered app inputs.')
  }

  await currentHarnessSession.page.evaluate(
    ({ fieldSelector, fieldIndex, text, clear }) => {
      const fields = Array.from(document.querySelectorAll(fieldSelector))
      const element = fields[fieldIndex]

      if (!(element instanceof HTMLElement)) {
        throw new Error('Grecko could not find that field in the current app view.')
      }

      element.focus()

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = clear ? text : `${element.value}${text}`
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        return
      }

      if (element.isContentEditable) {
        element.textContent = clear ? text : `${element.textContent ?? ''}${text}`
        element.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }))
      }
    },
    {
      fieldSelector: FIELD_SELECTOR,
      fieldIndex,
      text,
      clear,
    },
  )

  currentHarnessSession.interactionCount += 1
  appendLog(currentHarnessSession, 'system', `Typed into field ${fieldIndex + 1}.`)
  await wait(500)
  return updateHarnessSnapshot(currentHarnessSession, true)
}

export async function pressHarness(payload = {}) {
  if (!currentHarnessSession?.page) {
    throw new Error('No browser harness session is active.')
  }

  const key = payload.key?.trim()

  if (!key) {
    throw new Error('Provide a keyboard key for the browser harness to press.')
  }

  await currentHarnessSession.page.keyboard.press(key)
  currentHarnessSession.interactionCount += 1
  appendLog(currentHarnessSession, 'system', `Pressed key: ${key}`)
  await wait(500)
  return updateHarnessSnapshot(currentHarnessSession, true)
}

export async function stopHarness() {
  const session = currentHarnessSession

  if (!session) {
    return null
  }

  session.status = 'stopped'
  appendLog(session, 'system', 'Stopping no-integration browser harness.')
  const serialized = serializeHarnessSession(session)
  await closeHarnessBrowser()
  return {
    ...serialized,
    status: 'stopped',
  }
}

export async function resetHarnessStateForTests() {
  await closeHarnessBrowser()
}
