import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { XMLParser } from 'fast-xml-parser'

const LOG_LIMIT = 120
const ANDROID_DATA_DIR = path.join(process.cwd(), '.grecko-data', 'android')
const APK_CACHE_DIR = path.join(ANDROID_DATA_DIR, 'apks')
const DEFAULT_PACKAGE_NAME = 'com.futo.notes'
const DEFAULT_ACTIVITY_NAME = `${DEFAULT_PACKAGE_NAME}/.MainActivity`
const LOCAL_SDK_ROOT = process.env.GRECKO_ANDROID_SDK_ROOT
  ? path.resolve(process.env.GRECKO_ANDROID_SDK_ROOT)
  : path.join(process.cwd(), '.local', 'android-sdk')
const ADB_CANDIDATES = [
  process.env.GRECKO_ADB_BINARY,
  path.join(LOCAL_SDK_ROOT, 'platform-tools', 'adb'),
  path.join(process.env.HOME ?? '', 'Android', 'Sdk', 'platform-tools', 'adb'),
].filter(Boolean)

const KEYCODES = {
  enter: 'KEYCODE_ENTER',
  back: 'KEYCODE_BACK',
  home: 'KEYCODE_HOME',
  tab: 'KEYCODE_TAB',
  escape: 'KEYCODE_ESCAPE',
  search: 'KEYCODE_SEARCH',
  menu: 'KEYCODE_MENU',
  space: 'KEYCODE_SPACE',
  del: 'KEYCODE_DEL',
  delete: 'KEYCODE_FORWARD_DEL',
}

let currentAndroidSession = null

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  trimValues: false,
})

function ensureAndroidDataDir() {
  fs.mkdirSync(APK_CACHE_DIR, { recursive: true })
}

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

function resolveAdbBinary() {
  for (const candidate of ADB_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }

  const which = spawnSync('bash', ['-lc', 'which adb 2>/dev/null | head -n 1'], {
    encoding: 'utf8',
    stdio: 'pipe',
  })
  const binary = which.stdout.trim()

  if (binary) {
    return binary
  }

  throw new Error(
    'Grecko could not find adb. Set GRECKO_ADB_BINARY or GRECKO_ANDROID_SDK_ROOT, or install Android platform-tools.',
  )
}

function runAdb(args, options = {}) {
  const adb = resolveAdbBinary()
  const result = spawnSync(adb, args, {
    encoding: options.encoding ?? 'utf8',
    stdio: 'pipe',
    maxBuffer: 32 * 1024 * 1024,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'adb command failed.').trim())
  }

  return result
}

function runAdbShell(serial, ...shellArgs) {
  return runAdb(['-s', serial, 'shell', ...shellArgs])
}

function parseBounds(bounds) {
  const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(bounds ?? '')

  if (!match) {
    return null
  }

  const left = Number(match[1])
  const top = Number(match[2])
  const right = Number(match[3])
  const bottom = Number(match[4])

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: Math.round((left + right) / 2),
    centerY: Math.round((top + bottom) / 2),
  }
}

export function parseAndroidDevices(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('List of devices attached'))
    .map((line) => {
      const [serial = '', state = 'unknown', ...metadataParts] = line.split(/\s+/)
      const metadata = metadataParts.reduce((accumulator, part) => {
        const [key, ...rest] = part.split(':')
        if (key && rest.length > 0) {
          accumulator[key] = rest.join(':')
        }
        return accumulator
      }, {})

      return {
        serial,
        state,
        model: metadata.model ?? metadata.device ?? null,
        product: metadata.product ?? null,
        transportId: metadata.transport_id ?? null,
        isEmulator: serial.startsWith('emulator-'),
      }
    })
    .filter((device) => device.serial)
}

export function listAndroidDevices() {
  const output = runAdb(['devices', '-l']).stdout
  return parseAndroidDevices(output)
}

function assertReadyDevice(serial) {
  const devices = listAndroidDevices()
  const selected = serial
    ? devices.find((device) => device.serial === serial)
    : devices.find((device) => device.state === 'device')

  if (!selected) {
    throw new Error('Grecko could not find a ready Android device or emulator.')
  }

  if (selected.state !== 'device') {
    throw new Error(`Android target ${selected.serial} is ${selected.state}, not ready.`)
  }

  return selected
}

function flattenNodes(node, accumulator = []) {
  if (!node || typeof node !== 'object') {
    return accumulator
  }

  const children = Array.isArray(node.node) ? node.node : node.node ? [node.node] : []

  if (node.class || node['resource-id'] || node.text || node['content-desc']) {
    accumulator.push(node)
  }

  for (const child of children) {
    flattenNodes(child, accumulator)
  }

  return accumulator
}

function summarizeNodeLabel(node, index) {
  return (
    node.text?.trim() ||
    node['content-desc']?.trim() ||
    node['resource-id']?.split('/').pop()?.trim() ||
    node.class?.split('.').pop()?.trim() ||
    `control-${index + 1}`
  )
}

export function parseAndroidUiXml(xml) {
  const payload = parser.parse(xml)
  const rootNodes = Array.isArray(payload?.hierarchy?.node)
    ? payload.hierarchy.node
    : payload?.hierarchy?.node
      ? [payload.hierarchy.node]
      : []
  const nodes = rootNodes.flatMap((node) => flattenNodes(node))

  const buttons = nodes
    .filter((node) => node.clickable === 'true' && node.enabled !== 'false')
    .map((node, index) => ({
      index,
      text: summarizeNodeLabel(node, index),
      ariaLabel: node['content-desc'] ?? '',
      tagName: node.class?.split('.').pop()?.toLowerCase() ?? 'node',
      bounds: node.bounds ?? '',
      resourceId: node['resource-id'] ?? '',
    }))
    .filter((button) => button.text)
    .slice(0, 20)

  const fields = nodes
    .filter(
      (node) =>
        node.class?.includes('EditText') ||
        node.editable === 'true',
    )
    .map((node, index) => ({
      index,
      tagName: node.class?.split('.').pop()?.toLowerCase() ?? 'edittext',
      type: node.password === 'true' ? 'password' : 'text',
      placeholder: node.hint?.trim?.() ?? '',
      ariaLabel: node['content-desc']?.trim?.() ?? '',
      name: node['resource-id'] ?? '',
      value: node.text ?? '',
      bounds: node.bounds ?? '',
      resourceId: node['resource-id'] ?? '',
    }))
    .slice(0, 12)

  const textParts = nodes
    .map((node) => [node.text, node['content-desc']].filter(Boolean).join(' ').trim())
    .filter(Boolean)

  return {
    buttons,
    fields,
    bodyTextExcerpt: [...new Set(textParts)].join(' ').replace(/\s+/g, ' ').trim().slice(0, 700),
  }
}

function getCurrentFocus(serial) {
  try {
    const activity = runAdbShell(serial, 'dumpsys', 'activity', 'activities').stdout
    const match = activity.match(/mResumedActivity:.*? ([A-Za-z0-9._$]+\/[A-Za-z0-9._$]+) /)
    return match?.[1] ?? ''
  } catch {
    return ''
  }
}

function readUiXml(serial) {
  runAdbShell(serial, 'uiautomator', 'dump', '/sdcard/grecko-window-dump.xml')
  return runAdb(['-s', serial, 'exec-out', 'cat', '/sdcard/grecko-window-dump.xml']).stdout
}

function readScreenshotDataUrl(serial) {
  const screenshot = runAdb(['-s', serial, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer',
  }).stdout

  return `data:image/png;base64,${Buffer.from(screenshot).toString('base64')}`
}

function serializeAndroidSession(session) {
  if (!session) {
    return null
  }

  return {
    id: session.id,
    mode: 'android',
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
    deviceSerial: session.deviceSerial,
    packageName: session.packageName,
  }
}

function updateAndroidSnapshot(session) {
  const xml = readUiXml(session.deviceSerial)
  const snapshot = parseAndroidUiXml(xml)
  session.currentUrl = getCurrentFocus(session.deviceSerial) || session.currentUrl
  session.title = session.packageName
  session.bodyTextExcerpt = snapshot.bodyTextExcerpt
  session.buttons = snapshot.buttons
  session.fields = snapshot.fields
  session.screenshotDataUrl = readScreenshotDataUrl(session.deviceSerial)
  session.lastActionAt = new Date().toISOString()
  return serializeAndroidSession(session)
}

function typeWithAdb(serial, text) {
  for (const character of text) {
    if (character === '\n') {
      runAdbShell(serial, 'input', 'keyevent', KEYCODES.enter)
      continue
    }

    if (character === ' ') {
      runAdbShell(serial, 'input', 'keyevent', KEYCODES.space)
      continue
    }

    if (/^[a-zA-Z0-9]$/.test(character)) {
      runAdbShell(serial, 'input', 'text', character)
      continue
    }

    if (character === '.') {
      runAdbShell(serial, 'input', 'keyevent', 'KEYCODE_PERIOD')
      continue
    }

    if (character === ',') {
      runAdbShell(serial, 'input', 'keyevent', 'KEYCODE_COMMA')
      continue
    }

    if (character === '-') {
      runAdbShell(serial, 'input', 'keyevent', 'KEYCODE_MINUS')
      continue
    }

    if (character === "'") {
      runAdbShell(serial, 'input', 'keyevent', 'KEYCODE_APOSTROPHE')
      continue
    }

    if (character === '/') {
      runAdbShell(serial, 'input', 'keyevent', 'KEYCODE_SLASH')
      continue
    }

    runAdbShell(serial, 'input', 'text', '_')
  }
}

export async function attachAndroidHarness(payload = {}) {
  const device = assertReadyDevice(payload.serial)
  const packageName = payload.packageName?.trim() || DEFAULT_PACKAGE_NAME

  currentAndroidSession = {
    id: crypto.randomUUID(),
    mode: 'android',
    status: 'attached',
    attachedAt: new Date().toISOString(),
    lastActionAt: new Date().toISOString(),
    currentUrl: '',
    targetUrl: device.serial,
    title: packageName,
    interactionCount: 0,
    buttons: [],
    fields: [],
    bodyTextExcerpt: '',
    screenshotDataUrl: null,
    logs: [],
    deviceSerial: device.serial,
    packageName,
  }

  appendLog(
    currentAndroidSession,
    'system',
    `Attached Android harness to ${device.serial} for ${packageName}.`,
  )

  try {
    return updateAndroidSnapshot(currentAndroidSession)
  } catch (error) {
    currentAndroidSession.status = 'failed'
    appendLog(
      currentAndroidSession,
      'system',
      error instanceof Error ? error.message : 'Android harness attach failed.',
    )
    throw error
  }
}

export function getAndroidHarnessSession() {
  return serializeAndroidSession(currentAndroidSession)
}

export async function refreshAndroidHarness() {
  if (!currentAndroidSession) {
    return null
  }

  return updateAndroidSnapshot(currentAndroidSession)
}

export async function clickAndroidHarness(payload = {}) {
  if (!currentAndroidSession) {
    throw new Error('No Android harness session is active.')
  }

  const buttonIndex = Number(payload.buttonIndex)

  if (!Number.isInteger(buttonIndex)) {
    throw new Error('Choose a valid Android control.')
  }

  const button = currentAndroidSession.buttons[buttonIndex]
  const bounds = parseBounds(button?.bounds)

  if (!button || !bounds) {
    throw new Error('Grecko could not resolve that Android control.')
  }

  runAdbShell(
    currentAndroidSession.deviceSerial,
    'input',
    'tap',
    String(bounds.centerX),
    String(bounds.centerY),
  )
  currentAndroidSession.interactionCount += 1
  appendLog(currentAndroidSession, 'system', `Tapped Android control: ${button.text}`)
  return updateAndroidSnapshot(currentAndroidSession)
}

export async function typeAndroidHarness(payload = {}) {
  if (!currentAndroidSession) {
    throw new Error('No Android harness session is active.')
  }

  const fieldIndex = Number(payload.fieldIndex)
  const text = String(payload.text ?? '')
  const clear = payload.clear !== false
  const field = currentAndroidSession.fields[fieldIndex]
  const bounds = parseBounds(field?.bounds)

  if (!Number.isInteger(fieldIndex) || !field || !bounds) {
    throw new Error('Choose a valid Android field.')
  }

  runAdbShell(
    currentAndroidSession.deviceSerial,
    'input',
    'tap',
    String(bounds.centerX),
    String(bounds.centerY),
  )

  if (clear && field.value) {
    for (let index = 0; index < field.value.length + 4; index += 1) {
      runAdbShell(currentAndroidSession.deviceSerial, 'input', 'keyevent', KEYCODES.del)
    }
  }

  typeWithAdb(currentAndroidSession.deviceSerial, text)
  currentAndroidSession.interactionCount += 1
  appendLog(currentAndroidSession, 'system', `Typed into Android field ${fieldIndex + 1}.`)
  return updateAndroidSnapshot(currentAndroidSession)
}

export async function pressAndroidHarness(payload = {}) {
  if (!currentAndroidSession) {
    throw new Error('No Android harness session is active.')
  }

  const key = String(payload.key ?? '').trim()

  if (!key) {
    throw new Error('Provide a key for the Android harness.')
  }

  const normalized = key.toLowerCase()
  const keycode = KEYCODES[normalized] ?? (normalized.startsWith('keycode_') ? normalized.toUpperCase() : null)

  if (!keycode) {
    throw new Error(`Unsupported Android key: ${key}`)
  }

  runAdbShell(currentAndroidSession.deviceSerial, 'input', 'keyevent', keycode)
  currentAndroidSession.interactionCount += 1
  appendLog(currentAndroidSession, 'system', `Pressed Android key: ${keycode}`)
  return updateAndroidSnapshot(currentAndroidSession)
}

export async function stopAndroidHarness() {
  const session = currentAndroidSession

  if (!session) {
    return null
  }

  session.status = 'stopped'
  appendLog(session, 'system', 'Stopping Android harness session.')
  currentAndroidSession = null
  return {
    ...serializeAndroidSession(session),
    status: 'stopped',
  }
}

async function downloadApk(apkUrl) {
  ensureAndroidDataDir()
  const url = new URL(apkUrl)
  const fileName = path.basename(url.pathname) || `${crypto.randomUUID()}.apk`
  const destination = path.join(APK_CACHE_DIR, fileName)

  if (!fs.existsSync(destination)) {
    const response = await fetch(apkUrl)

    if (!response.ok) {
      throw new Error(`Could not download APK from ${apkUrl} (${response.status}).`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(destination, buffer)
  }

  return destination
}

export async function installAndroidApk(payload = {}) {
  const device = assertReadyDevice(payload.serial)
  const apkPath = payload.apkPath?.trim()
    ? path.resolve(payload.apkPath.trim())
    : payload.apkUrl?.trim()
      ? await downloadApk(payload.apkUrl.trim())
      : null

  if (!apkPath) {
    throw new Error('Provide an Android APK URL or file path.')
  }

  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK not found: ${apkPath}`)
  }

  const result = runAdb(['-s', device.serial, 'install', '-r', apkPath])

  return {
    serial: device.serial,
    apkPath,
    output: result.stdout.trim() || 'Success',
  }
}

export function launchAndroidApp(payload = {}) {
  const device = assertReadyDevice(payload.serial)
  const packageName = payload.packageName?.trim() || DEFAULT_PACKAGE_NAME
  const activityName = payload.activityName?.trim() || DEFAULT_ACTIVITY_NAME

  try {
    runAdb(['-s', device.serial, 'shell', 'am', 'start', '-n', activityName])
  } catch {
    runAdb([
      '-s',
      device.serial,
      'shell',
      'monkey',
      '-p',
      packageName,
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ])
  }

  return {
    serial: device.serial,
    packageName,
    activityName,
  }
}

export function stopAndroidApp(payload = {}) {
  const device = assertReadyDevice(payload.serial)
  const packageName = payload.packageName?.trim() || DEFAULT_PACKAGE_NAME
  runAdb(['-s', device.serial, 'shell', 'am', 'force-stop', packageName])
  return {
    serial: device.serial,
    packageName,
  }
}

export function inspectAndroidApp(payload = {}) {
  const device = assertReadyDevice(payload.serial)
  const packageName = payload.packageName?.trim() || DEFAULT_PACKAGE_NAME
  const pidResult = runAdb([
    '-s',
    device.serial,
    'shell',
    'sh',
    '-c',
    `pidof ${packageName} || true`,
  ])
  const windowResult = runAdb(['-s', device.serial, 'shell', 'dumpsys', 'window', 'windows'])
  const pid = pidResult.stdout.trim().split(/\s+/).filter(Boolean)[0] ?? null
  const windowDump = windowResult.stdout

  return {
    serial: device.serial,
    packageName,
    pid,
    running: Boolean(pid),
    focused: windowDump.includes(packageName),
  }
}

export async function resetAndroidStateForTests() {
  currentAndroidSession = null
}
