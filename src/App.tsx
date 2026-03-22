import { useEffect, useId, useMemo, useState } from 'react'
import './App.css'
import {
  fetchAndroidDevices,
  installAndroidRelease,
  launchAndroidTarget,
  stopAndroidTarget,
  type AndroidDevice,
} from './lib/android-client'
import {
  detectReleaseProvider,
  stonefruitReleaseUrl,
  validateReleaseIntake,
} from './lib/release-intake'
import {
  checkBridgeSession,
  fetchBridgeSession,
  startBridgeSession,
  stopBridgeSession,
  type BridgeSession,
} from './lib/bridge-client'
import {
  attachHarnessSession,
  clickHarnessControl,
  fetchHarnessSession,
  pressHarnessKey,
  refreshHarnessSession,
  stopHarnessSession,
  typeHarnessField,
  type HarnessSession,
} from './lib/harness-client'
import {
  createRun as createRunRecord,
  executeRun as executeRunRecord,
  fetchRuns,
  syncRun as syncRunRecord,
  type RunRecord,
} from './lib/runs-client'
import {
  fetchRunnerSession,
  startRunnerSession,
  stopRunnerSession,
  type RunnerSession,
} from './lib/runner-client'

const launchPillars = [
  {
    eyebrow: 'Artifact intake',
    title: 'Start from a public release URL',
    body:
      'Grecko now resolves public GitHub and GitLab releases into a persisted intake run with selected Linux and Android assets.',
  },
  {
    eyebrow: 'No-integration mode',
    title: 'Use the app through browser or Android harnesses first',
    body:
      'Grecko can now attach Chrome directly to a local app URL or drive an Android device over adb, so it can click controls, type into fields, and inspect the live UI without any target-side plugin.',
  },
  {
    eyebrow: 'Deep integration',
    title: 'Keep the Tauri MCP bridge as an optional upgrade',
    body:
      'The Hypothesi MCP stack gives AI harnesses screenshots, DOM state, logs, IPC visibility, and device discovery once the target app installs the bridge plugin.',
  },
  {
    eyebrow: 'Decision layer',
    title: 'Return ship, investigate, or block',
    body:
      'The current intake verdict is deterministic: block if required assets are missing, investigate once intake is complete but execution evidence is still pending.',
  },
] as const

const defaultRunnerCommand = 'npm run tauri:dev'
const defaultRunnerDirectory = '/home/justin/Developer/stonefruit'
const defaultBridgePort = '9223'
const defaultAndroidPackage = 'com.futo.notes'
const defaultAndroidActivity = 'com.futo.notes/.MainActivity'

function formatRunnerStatus(session: RunnerSession | null) {
  if (!session) return 'Runner idle'
  if (session.status === 'running') return 'App running'
  if (session.status === 'stopped') return 'Stopped'
  if (session.status === 'failed') return 'Launch failed'
  return 'Exited cleanly'
}

function formatAndroidLaunchStatus(
  execution: NonNullable<RunRecord['execution']>['android'] | null | undefined,
) {
  if (!execution) return 'No Android launch evidence has been recorded yet.'
  if (execution.status === 'running') {
    return `Android app running on ${execution.serial}${execution.pid ? ` with PID ${execution.pid}` : ''}.`
  }
  if (execution.status === 'failed') return 'Android launch failed.'
  return `Android app launch completed on ${execution.serial}.`
}

function formatBridgeStatus(session: BridgeSession | null) {
  if (!session) return 'Bridge idle'
  if (session.status === 'ready') return 'Bridge connected'
  if (session.status === 'unavailable') return 'Bridge not installed'
  if (session.status === 'failed') return 'Bridge failed'
  if (session.status === 'stopped') return 'Bridge stopped'
  return 'Bridge idle'
}

function formatHarnessStatus(session: HarnessSession | null) {
  if (!session) return 'Harness idle'
  if (session.status === 'attached') {
    return session.mode === 'android' ? 'Android harness attached' : 'Browser harness attached'
  }
  if (session.status === 'failed') return 'Harness failed'
  return 'Harness stopped'
}

function formatStageStatus(stage: string) {
  if (stage === 'completed') return 'Completed'
  if (stage === 'running') return 'Running'
  if (stage === 'failed') return 'Failed'
  if (stage === 'unavailable') return 'Unavailable'
  return 'Pending'
}

function App() {
  const intakeId = useId()
  const runnerCommandId = useId()
  const runnerDirectoryId = useId()
  const bridgePortId = useId()
  const harnessModeId = useId()
  const harnessUrlId = useId()
  const harnessTextId = useId()
  const harnessKeyId = useId()
  const harnessFieldId = useId()
  const harnessDeviceId = useId()
  const androidDeviceId = useId()
  const androidPackageId = useId()
  const androidActivityId = useId()
  const harnessPackageId = useId()

  const [releaseUrl, setReleaseUrl] = useState(stonefruitReleaseUrl)
  const [runnerCommand, setRunnerCommand] = useState(defaultRunnerCommand)
  const [runnerDirectory, setRunnerDirectory] = useState(defaultRunnerDirectory)
  const [bridgePort, setBridgePort] = useState(defaultBridgePort)
  const [harnessMode, setHarnessMode] = useState<'browser' | 'android'>('browser')
  const [harnessUrl, setHarnessUrl] = useState('')
  const [harnessText, setHarnessText] = useState('Grecko QA note')
  const [harnessKey, setHarnessKey] = useState('Enter')
  const [selectedFieldIndex, setSelectedFieldIndex] = useState('0')
  const [androidDevices, setAndroidDevices] = useState<AndroidDevice[]>([])
  const [selectedAndroidSerial, setSelectedAndroidSerial] = useState('')
  const [androidPackageName, setAndroidPackageName] = useState(defaultAndroidPackage)
  const [androidActivityName, setAndroidActivityName] = useState(defaultAndroidActivity)
  const [androidBusy, setAndroidBusy] = useState(false)
  const [androidError, setAndroidError] = useState('')
  const [androidStatus, setAndroidStatus] = useState('')
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [runBusy, setRunBusy] = useState(false)
  const [runError, setRunError] = useState('')
  const [runnerSession, setRunnerSession] = useState<RunnerSession | null>(null)
  const [harnessSession, setHarnessSession] = useState<HarnessSession | null>(null)
  const [bridgeSession, setBridgeSession] = useState<BridgeSession | null>(null)
  const [runnerError, setRunnerError] = useState('')
  const [harnessError, setHarnessError] = useState('')
  const [bridgeError, setBridgeError] = useState('')
  const [runnerBusy, setRunnerBusy] = useState(false)
  const [harnessBusy, setHarnessBusy] = useState(false)
  const [bridgeBusy, setBridgeBusy] = useState(false)

  const intake = validateReleaseIntake(releaseUrl)
  const provider = detectReleaseProvider(releaseUrl)

  const activeRun = useMemo(() => {
    if (runs.length === 0) {
      return null
    }

    return runs.find((run) => run.id === activeRunId) ?? runs[0]
  }, [activeRunId, runs])

  async function refreshRuns(showErrors = true) {
    try {
      const nextRuns = await fetchRuns()
      setRuns(nextRuns)
      if (!activeRunId && nextRuns[0]) {
        setActiveRunId(nextRuns[0].id)
      }
      if (showErrors) {
        setRunError('')
      }
    } catch (error) {
      if (!showErrors) {
        return
      }

      setRunError(
        error instanceof Error ? error.message : 'Could not load Grecko runs.',
      )
    }
  }

  async function refreshRunner(showErrors = true) {
    try {
      const session = await fetchRunnerSession()
      setRunnerSession(session)
      if (showErrors) {
        setRunnerError('')
      }
    } catch (error) {
      if (!showErrors) {
        return
      }

      setRunnerError(
        error instanceof Error ? error.message : 'Could not reach the Grecko runner API.',
      )
    }
  }

  async function refreshBridge(showErrors = true) {
    try {
      const session = await fetchBridgeSession()
      setBridgeSession(session)
      if (showErrors) {
        setBridgeError('')
      }
    } catch (error) {
      if (!showErrors) {
        return
      }

      setBridgeError(
        error instanceof Error ? error.message : 'Could not reach the Grecko bridge API.',
      )
    }
  }

  async function refreshHarness(showErrors = true) {
    try {
      const session = await fetchHarnessSession()
      setHarnessSession(session)
      if (session?.mode) {
        setHarnessMode(session.mode)
      }
      if (session?.deviceSerial) {
        setSelectedAndroidSerial(session.deviceSerial)
      }
      if (showErrors) {
        setHarnessError('')
      }
    } catch (error) {
      if (!showErrors) {
        return
      }

      setHarnessError(
        error instanceof Error ? error.message : 'Could not reach the browser harness API.',
      )
    }
  }

  async function refreshAndroid(showErrors = true) {
    try {
      const devices = await fetchAndroidDevices()
      setAndroidDevices(devices)
      setSelectedAndroidSerial((currentSerial) => {
        if (currentSerial && devices.some((device) => device.serial === currentSerial)) {
          return currentSerial
        }

        return devices[0]?.serial ?? ''
      })
      if (showErrors) {
        setAndroidError('')
      }
    } catch (error) {
      if (!showErrors) {
        return
      }

      setAndroidError(
        error instanceof Error ? error.message : 'Could not reach the Android lab API.',
      )
    }
  }

  async function syncActiveRunEvidence() {
    if (!activeRun?.execution) {
      return
    }

    const run = await syncRunRecord({ runId: activeRun.id })

    if (!run) {
      return
    }

    setRuns((currentRuns) =>
      currentRuns.map((currentRun) => (currentRun.id === run.id ? run : currentRun)),
    )
  }

  useEffect(() => {
    void fetchRuns()
      .then((nextRuns) => {
        setRuns(nextRuns)
        if (nextRuns[0]) {
          setActiveRunId(nextRuns[0].id)
        }
        setRunError('')
      })
      .catch((error) => {
        setRunError(
          error instanceof Error ? error.message : 'Could not load Grecko runs.',
        )
      })

    void fetchRunnerSession()
      .then((session) => {
        setRunnerSession(session)
        setRunnerError('')
      })
      .catch((error) => {
        setRunnerError(
          error instanceof Error
            ? error.message
            : 'Could not reach the Grecko runner API.',
        )
      })

    void fetchBridgeSession()
      .then((session) => {
        setBridgeSession(session)
        setBridgeError('')
      })
      .catch((error) => {
        setBridgeError(
          error instanceof Error
            ? error.message
            : 'Could not reach the Grecko bridge API.',
        )
      })

    void fetchHarnessSession()
      .then((session) => {
        setHarnessSession(session)
        if (session?.mode) {
          setHarnessMode(session.mode)
        }
        if (session?.deviceSerial) {
          setSelectedAndroidSerial(session.deviceSerial)
        }
        setHarnessError('')
        if (session?.fields[0]) {
          setSelectedFieldIndex(String(session.fields[0].index))
        }
      })
      .catch((error) => {
        setHarnessError(
          error instanceof Error
            ? error.message
            : 'Could not reach the browser harness API.',
        )
      })

    void fetchAndroidDevices()
      .then((devices) => {
        setAndroidDevices(devices)
        if (devices[0]) {
          setSelectedAndroidSerial(devices[0].serial)
        }
        setAndroidError('')
      })
      .catch((error) => {
        setAndroidError(
          error instanceof Error
            ? error.message
            : 'Could not reach the Android lab API.',
        )
      })
  }, [])

  useEffect(() => {
    if (runnerSession?.status !== 'running') {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshRunner(false)
      void refreshHarness(false)
      void refreshBridge(false)
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [runnerSession?.id, runnerSession?.status])

  useEffect(() => {
    if (harnessMode !== 'android') {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshAndroid(false)
    }, 2_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [harnessMode])

  useEffect(() => {
    if (!activeRun?.execution || runnerSession?.status !== 'running') {
      return
    }

    const intervalId = window.setInterval(() => {
      void syncRunRecord({ runId: activeRun.id })
        .then((run) => {
          if (!run) {
            return
          }

          setRuns((currentRuns) =>
            currentRuns.map((currentRun) =>
              currentRun.id === run.id ? run : currentRun,
            ),
          )
        })
        .catch(() => {})
    }, 2_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeRun?.execution, activeRun?.id, runnerSession?.status])

  useEffect(() => {
    if (!harnessSession?.fields.length) {
      return
    }

    if (
      !harnessSession.fields.some(
        (field) => String(field.index) === selectedFieldIndex,
      )
    ) {
      setSelectedFieldIndex(String(harnessSession.fields[0].index))
    }
  }, [harnessSession?.fields, selectedFieldIndex])

  async function handleCreateRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRunBusy(true)

    try {
      const run = await createRunRecord({ releaseUrl })

      if (!run) {
        throw new Error('Grecko did not return a run record.')
      }

      setRuns((currentRuns) => [
        run,
        ...currentRuns.filter((currentRun) => currentRun.id !== run.id),
      ])
      setActiveRunId(run.id)
      setRunError('')
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : 'Grecko could not resolve that release.',
      )
    } finally {
      setRunBusy(false)
    }
  }

  async function handleExecuteRun() {
    if (!activeRun) {
      setRunError('Create or select a run before asking Grecko to execute it.')
      return
    }

    setRunBusy(true)

    try {
      const run = await executeRunRecord({
        runId: activeRun.id,
        command: runnerCommand,
        cwd: runnerDirectory,
        port: Number(bridgePort) || Number(defaultBridgePort),
      })

      if (!run) {
        throw new Error('Grecko did not return execution evidence for that run.')
      }

      setRuns((currentRuns) =>
        currentRuns.map((currentRun) => (currentRun.id === run.id ? run : currentRun)),
      )
      setActiveRunId(run.id)
      setRunError('')
      await Promise.all([refreshRunner(false), refreshHarness(false), refreshBridge(false)])
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : 'Grecko could not execute that run.',
      )
    } finally {
      setRunBusy(false)
    }
  }

  async function handleSyncRun() {
    if (!activeRun) {
      setRunError('Select a run before syncing execution evidence.')
      return
    }

    setRunBusy(true)

    try {
      const run = await syncRunRecord({ runId: activeRun.id })

      if (!run) {
        throw new Error('Grecko did not return an updated run record.')
      }

      setRuns((currentRuns) =>
        currentRuns.map((currentRun) => (currentRun.id === run.id ? run : currentRun)),
      )
      setRunError('')
      await Promise.all([refreshRunner(false), refreshHarness(false), refreshBridge(false)])
    } catch (error) {
      setRunError(
        error instanceof Error
          ? error.message
          : 'Grecko could not sync execution evidence for that run.',
      )
    } finally {
      setRunBusy(false)
    }
  }

  async function handleRunnerStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRunnerBusy(true)

    try {
      const session = await startRunnerSession({
        command: runnerCommand,
        cwd: runnerDirectory,
      })
      setRunnerSession(session)
      setRunnerError('')
    } catch (error) {
      setRunnerError(
        error instanceof Error ? error.message : 'Grecko could not start that app command.',
      )
    } finally {
      setRunnerBusy(false)
    }
  }

  async function handleRunnerStop() {
    setRunnerBusy(true)

    try {
      const session = await stopRunnerSession()
      setRunnerSession(session)
      setRunnerError('')
    } catch (error) {
      setRunnerError(
        error instanceof Error ? error.message : 'Grecko could not stop the active app.',
      )
    } finally {
      setRunnerBusy(false)
    }
  }

  async function handleHarnessAttach() {
    setHarnessBusy(true)

    try {
      const session = await attachHarnessSession({
        mode: harnessMode,
        url: harnessUrl.trim() || undefined,
        serial: harnessMode === 'android' ? selectedAndroidSerial || undefined : undefined,
        packageName:
          harnessMode === 'android' ? androidPackageName.trim() || undefined : undefined,
      })
      setHarnessSession(session)
      if (session?.mode) {
        setHarnessMode(session.mode)
      }
      if (session?.fields[0]) {
        setSelectedFieldIndex(String(session.fields[0].index))
      }
      setHarnessError('')
      await syncActiveRunEvidence()
    } catch (error) {
      setHarnessError(
        error instanceof Error
          ? error.message
          : `Grecko could not attach the ${harnessMode} harness.`,
      )
    } finally {
      setHarnessBusy(false)
    }
  }

  async function handleHarnessRefresh() {
    setHarnessBusy(true)

    try {
      const session = await refreshHarnessSession()
      setHarnessSession(session)
      if (session?.fields[0]) {
        setSelectedFieldIndex(String(session.fields[0].index))
      }
      setHarnessError('')
      await syncActiveRunEvidence()
    } catch (error) {
      setHarnessError(
        error instanceof Error
          ? error.message
          : 'Grecko could not refresh the browser harness snapshot.',
      )
    } finally {
      setHarnessBusy(false)
    }
  }

  async function handleHarnessClick(buttonIndex: number) {
    setHarnessBusy(true)

    try {
      const session = await clickHarnessControl({ buttonIndex })
      setHarnessSession(session)
      if (session?.fields[0]) {
        setSelectedFieldIndex(String(session.fields[0].index))
      }
      setHarnessError('')
      await syncActiveRunEvidence()
    } catch (error) {
      setHarnessError(
        error instanceof Error ? error.message : 'Grecko could not click that app control.',
      )
    } finally {
      setHarnessBusy(false)
    }
  }

  async function handleHarnessType() {
    setHarnessBusy(true)

    try {
      const session = await typeHarnessField({
        fieldIndex: Number(selectedFieldIndex),
        text: harnessText,
      })
      setHarnessSession(session)
      setHarnessError('')
      await syncActiveRunEvidence()
    } catch (error) {
      setHarnessError(
        error instanceof Error ? error.message : 'Grecko could not type into that field.',
      )
    } finally {
      setHarnessBusy(false)
    }
  }

  async function handleHarnessPress() {
    setHarnessBusy(true)

    try {
      const session = await pressHarnessKey({ key: harnessKey })
      setHarnessSession(session)
      setHarnessError('')
      await syncActiveRunEvidence()
    } catch (error) {
      setHarnessError(
        error instanceof Error ? error.message : 'Grecko could not send that key press.',
      )
    } finally {
      setHarnessBusy(false)
    }
  }

  async function handleHarnessStop() {
    setHarnessBusy(true)

    try {
      const session = await stopHarnessSession()
      setHarnessSession(session)
      setHarnessError('')
      await syncActiveRunEvidence()
    } catch (error) {
      setHarnessError(
        error instanceof Error ? error.message : 'Grecko could not stop the browser harness.',
      )
    } finally {
      setHarnessBusy(false)
    }
  }

  async function handleAndroidInstall() {
    const apkUrl = activeRun?.release.selectedAssets.android?.url

    if (!selectedAndroidSerial) {
      setAndroidError('Select a ready Android device or emulator first.')
      return
    }

    if (!apkUrl) {
      setAndroidError('Create or select a run with a resolved Android APK first.')
      return
    }

    setAndroidBusy(true)

    try {
      const install = await installAndroidRelease({
        serial: selectedAndroidSerial,
        apkUrl,
      })
      setAndroidStatus(`Installed APK to ${install.serial}: ${install.output}`)
      setAndroidError('')
    } catch (error) {
      setAndroidError(
        error instanceof Error ? error.message : 'Grecko could not install the Android APK.',
      )
    } finally {
      setAndroidBusy(false)
    }
  }

  async function handleAndroidLaunch() {
    if (!selectedAndroidSerial) {
      setAndroidError('Select a ready Android device or emulator first.')
      return
    }

    setAndroidBusy(true)

    try {
      if (activeRun?.release.selectedAssets.android) {
        const run = await executeRunRecord({
          runId: activeRun.id,
          target: 'android',
          serial: selectedAndroidSerial,
          packageName: androidPackageName.trim() || defaultAndroidPackage,
          activityName: androidActivityName.trim() || defaultAndroidActivity,
        })

        if (!run) {
          throw new Error('Grecko did not return Android execution evidence for that run.')
        }

        setRuns((currentRuns) =>
          currentRuns.map((currentRun) => (currentRun.id === run.id ? run : currentRun)),
        )
        setActiveRunId(run.id)
        setAndroidStatus(
          `Installed and launched ${androidPackageName.trim() || defaultAndroidPackage} on ${selectedAndroidSerial}.`,
        )
        await Promise.all([refreshHarness(false), refreshAndroid(false)])
      } else {
        const launch = await launchAndroidTarget({
          serial: selectedAndroidSerial,
          packageName: androidPackageName.trim() || defaultAndroidPackage,
          activityName: androidActivityName.trim() || defaultAndroidActivity,
        })
        setAndroidStatus(`Launched ${launch.packageName} on ${launch.serial}.`)
      }

      setAndroidError('')
    } catch (error) {
      setAndroidError(
        error instanceof Error ? error.message : 'Grecko could not launch the Android app.',
      )
    } finally {
      setAndroidBusy(false)
    }
  }

  async function handleAndroidStop() {
    if (!selectedAndroidSerial) {
      setAndroidError('Select a ready Android device or emulator first.')
      return
    }

    setAndroidBusy(true)

    try {
      const launch = await stopAndroidTarget({
        serial: selectedAndroidSerial,
        packageName: androidPackageName.trim() || defaultAndroidPackage,
      })
      setAndroidStatus(`Stopped ${launch.packageName} on ${launch.serial}.`)
      setAndroidError('')
    } catch (error) {
      setAndroidError(
        error instanceof Error ? error.message : 'Grecko could not stop the Android app.',
      )
    } finally {
      setAndroidBusy(false)
    }
  }

  async function handleBridgeCheck() {
    setBridgeBusy(true)

    try {
      const session = await checkBridgeSession({
        cwd: runnerDirectory,
        port: Number(bridgePort) || Number(defaultBridgePort),
      })
      setBridgeSession(session)
      setBridgeError('')
    } catch (error) {
      setBridgeError(
        error instanceof Error
          ? error.message
          : 'Grecko could not inspect the Tauri MCP bridge.',
      )
    } finally {
      setBridgeBusy(false)
    }
  }

  async function handleBridgeStart() {
    setBridgeBusy(true)

    try {
      const session = await startBridgeSession({
        cwd: runnerDirectory,
        port: Number(bridgePort) || Number(defaultBridgePort),
      })
      setBridgeSession(session)
      setBridgeError('')
    } catch (error) {
      setBridgeError(
        error instanceof Error
          ? error.message
          : 'Grecko could not start the Tauri MCP bridge session.',
      )
    } finally {
      setBridgeBusy(false)
    }
  }

  async function handleBridgeStop() {
    setBridgeBusy(true)

    try {
      const session = await stopBridgeSession()
      setBridgeSession(session)
      setBridgeError('')
    } catch (error) {
      setBridgeError(
        error instanceof Error
          ? error.message
          : 'Grecko could not stop the Tauri MCP bridge session.',
      )
    } finally {
      setBridgeBusy(false)
    }
  }

  const displayPlatforms =
    activeRun?.release.targetStatuses.map((target) => ({
      name: target.target === 'linux' ? 'Linux' : 'Android',
      state: target.status,
      summary: target.summary,
    })) ?? [
      {
        name: 'Linux',
        state: 'pending',
        summary: 'Create a real run to see resolved Linux artifacts.',
      },
      {
        name: 'Android',
        state: 'pending',
        summary: 'Create a real run to see resolved Android artifacts.',
      },
    ]

  const dossierEntries =
    activeRun?.release.targetStatuses.map((target) => ({
      severity: target.status === 'ready' ? 'P2' : 'P1',
      title:
        target.status === 'ready'
          ? `${target.target} artifact selected`
          : `${target.target} artifact missing`,
      label: target.status === 'ready' ? 'intake evidence' : 'release blocker',
      evidence: target.selectedAsset
        ? `${target.selectedAsset.name} via ${target.selectedAsset.source}.`
        : target.summary,
    })) ??
    []

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#intake">
          <span className="brand__sigil" aria-hidden="true">
            G
          </span>
          <span>
            <strong>Grecko</strong>
            <small>the little Roman bug hunter</small>
          </span>
        </a>

        <nav className="topbar__nav" aria-label="Sections">
          <a href="#control-room">Control Room</a>
          <a href="#runner">Runner</a>
          <a href="#android">Android</a>
          <a href="#harness">Harness</a>
          <a href="#bridge">Bridge</a>
          <a href="#dossier">Dossier</a>
          <a href="#harnesses">Harnesses</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">Release confidence for Tauri apps</p>
            <h1>Grecko gives every build a case file before you ship it.</h1>
            <p className="lede">
              Feed Grecko a public release page, let the harness inspect the app,
              and get a verdict that reads like a careful release manager instead
              of a generic AI dashboard.
            </p>

            <div className="hero__chips" aria-label="Launch assumptions">
              <span>GitHub + GitLab release intake</span>
              <span>Linux + Android starter envelope</span>
              <span>Tauri MCP-aware harnesses</span>
            </div>
          </div>

          <aside className="hero__medallion" aria-label="Grecko mascot panel">
            <div className="medallion">
              <span className="medallion__halo" aria-hidden="true" />
              <span className="medallion__bug" aria-hidden="true">
                ⚲
              </span>
              <span className="medallion__caption">Roman bug hunter</span>
            </div>
          </aside>
        </section>

        <section className="grid" id="control-room">
          <article className="panel panel--intake" id="intake">
            <div className="panel__header">
              <p className="eyebrow">Run intake</p>
              <h2>Create a persisted release run</h2>
            </div>

            <form className="runner-form" onSubmit={handleCreateRun}>
              <label className="field" htmlFor={intakeId}>
                <span>Public release URL</span>
                <input
                  id={intakeId}
                  name="release-url"
                  type="url"
                  value={releaseUrl}
                  onChange={(event) => setReleaseUrl(event.target.value)}
                  placeholder="https://gitlab.example.com/group/app/-/releases"
                />
              </label>

              <div className="intake-status" role="status" aria-live="polite">
                <span className={`provider provider--${provider}`}>
                  {intake.headline}
                </span>
                <p>{intake.detail}</p>
              </div>

              <div className="runner-actions">
                <button className="button" type="submit" disabled={runBusy}>
                  {runBusy ? 'Resolving release...' : 'Create run'}
                </button>
                <button
                  className="button button--muted"
                  type="button"
                  disabled={runBusy}
                  onClick={() => void refreshRuns()}
                >
                  Refresh runs
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={runBusy || !activeRun}
                  onClick={() => void handleExecuteRun()}
                >
                  Execute active run
                </button>
                <button
                  className="button button--muted"
                  type="button"
                  disabled={runBusy || !activeRun?.execution}
                  onClick={() => void handleSyncRun()}
                >
                  Sync evidence
                </button>
              </div>

              <p className="helper">
                Execution uses the launch command, working directory, and bridge
                port from the runner and bridge panels below.
              </p>

              {runError ? (
                <p className="runner-error" role="alert">
                  {runError}
                </p>
              ) : null}
            </form>

            <dl className="facts">
              <div>
                <dt>Seed release</dt>
                <dd>Stonefruit GitLab releases</dd>
              </div>
              <div>
                <dt>Runs stored</dt>
                <dd>{runs.length}</dd>
              </div>
              <div>
                <dt>Latest release</dt>
                <dd>{activeRun?.release.tagName ?? 'No run yet'}</dd>
              </div>
            </dl>

            <div className="run-list">
              {runs.length === 0 ? (
                <p className="helper">
                  No runs yet. Create one from the Stonefruit release page to
                  persist real intake evidence.
                </p>
              ) : (
                runs.slice(0, 4).map((run) => (
                  <button
                    key={run.id}
                    className={`run-list__item${
                      activeRun?.id === run.id ? ' run-list__item--active' : ''
                    }`}
                    type="button"
                    onClick={() => setActiveRunId(run.id)}
                  >
                    <strong>{run.release.releaseName}</strong>
                    <span>{run.verdict.label}</span>
                    <small>
                      launch {run.stages.launch} · harness {run.stages.harness}
                    </small>
                  </button>
                ))
              )}
            </div>
          </article>

          <article className="panel panel--verdict">
            <div className="panel__header">
              <p className="eyebrow">Run verdict</p>
              <h2>Current control-room snapshot</h2>
            </div>

            <div className="verdict-strip">
              <span
                className={`verdict verdict--${
                  activeRun?.verdict.label ?? 'investigate'
                }`}
              >
                {activeRun?.verdict.label ?? 'investigate'}
              </span>
              <p>
                {activeRun?.verdict.summary ??
                  'Create a run to replace the mocked control-room verdict with a real intake verdict.'}
              </p>
            </div>

            <p className="baseline">
              {activeRun?.baseline.summary ??
                'No baseline yet. Grecko will need a successful prior run before it can mark regressions.'}
            </p>
            <p className="reference">
              Reference run target:{' '}
              <a
                href={activeRun?.release.releasePageUrl ?? stonefruitReleaseUrl}
                target="_blank"
                rel="noreferrer"
              >
                {activeRun?.release.releasePageUrl ?? stonefruitReleaseUrl}
              </a>
            </p>

            <div className="platforms" aria-label="Platform run states">
              {displayPlatforms.map((platform) => (
                <article
                  key={platform.name}
                  className={`platform platform--${platform.state}`}
                >
                  <header>
                    <h3>{platform.name}</h3>
                    <span>{platform.state}</span>
                  </header>
                  <p>{platform.summary}</p>
                </article>
              ))}
            </div>

            {activeRun ? (
              <div className="fact-strip">
                <span>{activeRun.release.projectPath}</span>
                <span>{activeRun.release.tagName}</span>
                <span>{activeRun.release.assets.length} assets resolved</span>
              </div>
            ) : null}

            {activeRun ? (
              <div className="stage-strip" aria-label="Run execution stages">
                <article className={`stage stage--${activeRun.stages.intake}`}>
                  <strong>Intake</strong>
                  <span>{formatStageStatus(activeRun.stages.intake)}</span>
                </article>
                <article className={`stage stage--${activeRun.stages.launch}`}>
                  <strong>Launch</strong>
                  <span>{formatStageStatus(activeRun.stages.launch)}</span>
                </article>
                <article className={`stage stage--${activeRun.stages.harness}`}>
                  <strong>Harness</strong>
                  <span>{formatStageStatus(activeRun.stages.harness)}</span>
                </article>
                <article className={`stage stage--${activeRun.stages.bridge}`}>
                  <strong>Bridge</strong>
                  <span>{formatStageStatus(activeRun.stages.bridge)}</span>
                </article>
              </div>
            ) : null}
          </article>
        </section>

        <section className="panel panel--runner" id="runner">
          <div className="panel__header">
            <p className="eyebrow">App runner</p>
            <h2>Launch the app Grecko should inspect</h2>
          </div>

          <div className="runner-grid">
            <form className="runner-form" onSubmit={handleRunnerStart}>
              <label className="field" htmlFor={runnerCommandId}>
                <span>Launch command</span>
                <input
                  id={runnerCommandId}
                  name="runner-command"
                  type="text"
                  value={runnerCommand}
                  onChange={(event) => setRunnerCommand(event.target.value)}
                  placeholder={defaultRunnerCommand}
                />
              </label>

              <label className="field" htmlFor={runnerDirectoryId}>
                <span>Working directory</span>
                <input
                  id={runnerDirectoryId}
                  name="runner-directory"
                  type="text"
                  value={runnerDirectory}
                  onChange={(event) => setRunnerDirectory(event.target.value)}
                  placeholder={defaultRunnerDirectory}
                />
              </label>

              <div className="runner-actions">
                <button
                  className="button"
                  type="submit"
                  disabled={runnerBusy || runnerSession?.status === 'running'}
                >
                  {runnerBusy ? 'Working...' : 'Run app'}
                </button>
                <button
                  className="button button--muted"
                  type="button"
                  disabled={runnerBusy || runnerSession?.status !== 'running'}
                  onClick={() => void handleRunnerStop()}
                >
                  Stop app
                </button>
                <button
                  className="button button--muted"
                  type="button"
                  disabled={runnerBusy}
                  onClick={() => void refreshRunner()}
                >
                  Refresh status
                </button>
              </div>

              <p className="helper">
                Grecko runs exactly the command you provide through a local API
                on your machine. Start with the real Stonefruit Tauri dev command
                inside the target project directory.
              </p>

              {runnerError ? (
                <p className="runner-error" role="alert">
                  {runnerError}
                </p>
              ) : null}
            </form>

            <article className="runner-card">
              <div className="runner-status">
                <span
                  className={`provider provider--${
                    runnerSession?.status ?? 'idle'
                  }`}
                >
                  {formatRunnerStatus(runnerSession)}
                </span>
                <p>
                  {runnerSession
                    ? 'Grecko is tracking one active or recent app session.'
                    : 'No app session yet. Start one from the control form.'}
                </p>
              </div>

              <dl className="facts facts--runner">
                <div>
                  <dt>PID</dt>
                  <dd>{runnerSession?.pid ?? 'Not started'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{runnerSession?.status ?? 'idle'}</dd>
                </div>
                <div>
                  <dt>Exit</dt>
                  <dd>
                    {runnerSession?.exitCode ?? runnerSession?.signal ?? 'Still running'}
                  </dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{runnerSession?.startedAt ?? '—'}</dd>
                </div>
                <div>
                  <dt>Directory</dt>
                  <dd>{runnerSession?.cwd ?? runnerDirectory}</dd>
                </div>
                <div>
                  <dt>Command</dt>
                  <dd>{runnerSession?.command ?? runnerCommand}</dd>
                </div>
              </dl>

              <pre className="runner-log">
                {runnerSession?.logs.join('\n') || 'No process output yet.'}
              </pre>
            </article>
          </div>
        </section>

        <section className="panel panel--android" id="android">
          <div className="panel__header">
            <p className="eyebrow">Android lab</p>
            <h2>Install and launch the release APK on a live device</h2>
          </div>

          <div className="runner-grid">
            <form
              className="runner-form"
              onSubmit={(event) => {
                event.preventDefault()
                void refreshAndroid()
              }}
            >
              <label className="field" htmlFor={androidDeviceId}>
                <span>Device or emulator</span>
                <select
                  id={androidDeviceId}
                  value={selectedAndroidSerial}
                  onChange={(event) => setSelectedAndroidSerial(event.target.value)}
                  disabled={androidBusy || androidDevices.length === 0}
                >
                  {androidDevices.length ? (
                    androidDevices.map((device) => (
                      <option key={device.serial} value={device.serial}>
                        {device.serial}
                        {device.model ? ` · ${device.model}` : ''}
                        {device.state !== 'device' ? ` · ${device.state}` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">No Android targets detected</option>
                  )}
                </select>
              </label>

              <label className="field" htmlFor={androidPackageId}>
                <span>Package name</span>
                <input
                  id={androidPackageId}
                  type="text"
                  value={androidPackageName}
                  onChange={(event) => setAndroidPackageName(event.target.value)}
                  placeholder={defaultAndroidPackage}
                />
              </label>

              <label className="field" htmlFor={androidActivityId}>
                <span>Launch activity</span>
                <input
                  id={androidActivityId}
                  type="text"
                  value={androidActivityName}
                  onChange={(event) => setAndroidActivityName(event.target.value)}
                  placeholder={defaultAndroidActivity}
                />
              </label>

              <div className="runner-actions">
                <button className="button button--muted" type="submit" disabled={androidBusy}>
                  {androidBusy ? 'Working...' : 'Refresh devices'}
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={androidBusy || !activeRun?.release.selectedAssets.android}
                  onClick={() => void handleAndroidInstall()}
                >
                  Install release APK
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={androidBusy || !selectedAndroidSerial}
                  onClick={() => void handleAndroidLaunch()}
                >
                  Launch app
                </button>
                <button
                  className="button button--muted"
                  type="button"
                  disabled={androidBusy || !selectedAndroidSerial}
                  onClick={() => void handleAndroidStop()}
                >
                  Stop app
                </button>
              </div>

              <p className="helper">
                Grecko installs the Android APK selected by the active run, launches the
                package on the chosen target, and then the shared no-integration harness can
                drive it over adb.
              </p>

              {androidStatus ? <p className="helper">{androidStatus}</p> : null}
              {androidError ? (
                <p className="runner-error" role="alert">
                  {androidError}
                </p>
              ) : null}
            </form>

            <article className="runner-card">
              <div className="runner-status">
                <span
                  className={`provider provider--${
                    androidDevices.some((device) => device.state === 'device')
                      ? 'attached'
                      : 'idle'
                  }`}
                >
                  {androidDevices.some((device) => device.state === 'device')
                    ? 'Android target ready'
                    : 'No Android target'}
                </span>
                <p>
                  {activeRun?.release.selectedAssets.android
                    ? `Active APK: ${activeRun.release.selectedAssets.android.name}`
                    : 'Create or select a run before installing an Android release artifact.'}
                </p>
              </div>

              <dl className="facts facts--runner">
                <div>
                  <dt>Targets</dt>
                  <dd>{androidDevices.length}</dd>
                </div>
                <div>
                  <dt>Selected</dt>
                  <dd>{selectedAndroidSerial || 'None'}</dd>
                </div>
                <div>
                  <dt>APK</dt>
                  <dd>{activeRun?.release.selectedAssets.android?.name ?? 'Not resolved'}</dd>
                </div>
                <div>
                  <dt>Package</dt>
                  <dd>{androidPackageName || defaultAndroidPackage}</dd>
                </div>
                <div>
                  <dt>Activity</dt>
                  <dd>{androidActivityName || defaultAndroidActivity}</dd>
                </div>
                <div>
                  <dt>Harness mode</dt>
                  <dd>{harnessSession?.mode ?? harnessMode}</dd>
                </div>
              </dl>

              <div className="run-list">
                {androidDevices.length ? (
                  androidDevices.map((device) => (
                    <button
                      key={device.serial}
                      className={`run-list__item${
                        selectedAndroidSerial === device.serial
                          ? ' run-list__item--active'
                          : ''
                      }`}
                      type="button"
                      onClick={() => setSelectedAndroidSerial(device.serial)}
                    >
                      <strong>{device.serial}</strong>
                      <span>{device.state}</span>
                      <small>
                        {device.model ?? device.product ?? 'Unknown model'}
                        {device.isEmulator ? ' · emulator' : ' · device'}
                      </small>
                    </button>
                  ))
                ) : (
                  <p className="helper">
                    No Android targets detected yet. Bring up a device or emulator, then
                    refresh devices.
                  </p>
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="panel panel--harness-runtime" id="harness">
          <div className="panel__header">
            <p className="eyebrow">No-Integration Harness</p>
            <h2>Use the app even when it has no MCP plugin</h2>
          </div>

          <div className="runner-grid">
            <form
              className="runner-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleHarnessAttach()
              }}
            >
              <label className="field" htmlFor={harnessModeId}>
                <span>Harness mode</span>
                <select
                  id={harnessModeId}
                  value={harnessMode}
                  onChange={(event) =>
                    setHarnessMode(event.target.value === 'android' ? 'android' : 'browser')
                  }
                  disabled={harnessBusy}
                >
                  <option value="browser">Browser</option>
                  <option value="android">Android</option>
                </select>
              </label>

              {harnessMode === 'browser' ? (
              <label className="field" htmlFor={harnessUrlId}>
                <span>Target URL override</span>
                <input
                  id={harnessUrlId}
                  name="harness-url"
                  type="text"
                  value={harnessUrl}
                  onChange={(event) => setHarnessUrl(event.target.value)}
                  placeholder={harnessSession?.targetUrl ?? 'Auto-detect from runner logs'}
                />
              </label>
              ) : (
                <>
                  <label className="field" htmlFor={harnessDeviceId}>
                    <span>Android device</span>
                    <select
                      id={harnessDeviceId}
                      value={selectedAndroidSerial}
                      onChange={(event) => setSelectedAndroidSerial(event.target.value)}
                      disabled={harnessBusy || androidDevices.length === 0}
                    >
                      {androidDevices.length ? (
                        androidDevices.map((device) => (
                          <option key={device.serial} value={device.serial}>
                            {device.serial}
                            {device.model ? ` · ${device.model}` : ''}
                          </option>
                        ))
                      ) : (
                        <option value="">No Android targets detected</option>
                      )}
                    </select>
                  </label>

                  <label className="field" htmlFor={harnessPackageId}>
                    <span>Android package</span>
                    <input
                      id={harnessPackageId}
                      name="harness-package"
                      type="text"
                      value={androidPackageName}
                      onChange={(event) => setAndroidPackageName(event.target.value)}
                      placeholder={defaultAndroidPackage}
                    />
                  </label>
                </>
              )}

              <div className="runner-actions">
                <button
                  className="button"
                  type="submit"
                  disabled={harnessBusy}
                >
                  {harnessBusy ? 'Working...' : 'Attach harness'}
                </button>
                <button
                  className="button button--muted"
                  type="button"
                  disabled={harnessBusy}
                  onClick={() => void handleHarnessRefresh()}
                >
                  Refresh harness
                </button>
                <button
                  className="button button--muted"
                  type="button"
                  disabled={harnessBusy || !harnessSession}
                  onClick={() => void handleHarnessStop()}
                >
                  Stop harness
                </button>
              </div>

              <p className="helper">
                {harnessMode === 'browser'
                  ? 'Grecko reads the launched app URL from runner logs, opens a real browser session, and treats that page as the no-integration app harness.'
                  : 'Grecko attaches to the selected Android target over adb, dumps the live UI tree, taps controls, types into editable fields, and captures device screenshots.'}
              </p>

              <label className="field" htmlFor={harnessFieldId}>
                <span>Type into discovered field</span>
                <select
                  id={harnessFieldId}
                  value={selectedFieldIndex}
                  onChange={(event) => setSelectedFieldIndex(event.target.value)}
                  disabled={harnessBusy || !harnessSession?.fields.length}
                >
                  {harnessSession?.fields.length ? (
                    harnessSession.fields.map((field) => (
                      <option key={field.index} value={field.index}>
                        {field.tagName}
                        {field.placeholder ? ` · ${field.placeholder}` : ''}
                        {field.ariaLabel ? ` · ${field.ariaLabel}` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="0">No fields discovered yet</option>
                  )}
                </select>
              </label>

              <label className="field" htmlFor={harnessTextId}>
                <span>Text payload</span>
                <input
                  id={harnessTextId}
                  name="harness-text"
                  type="text"
                  value={harnessText}
                  onChange={(event) => setHarnessText(event.target.value)}
                  placeholder="Grecko QA note"
                />
              </label>

              <div className="runner-actions">
                <button
                  className="button"
                  type="button"
                  disabled={harnessBusy || !harnessSession?.fields.length}
                  onClick={() => void handleHarnessType()}
                >
                  Type into field
                </button>
              </div>

              <label className="field" htmlFor={harnessKeyId}>
                <span>Keyboard key</span>
                <input
                  id={harnessKeyId}
                  name="harness-key"
                  type="text"
                  value={harnessKey}
                  onChange={(event) => setHarnessKey(event.target.value)}
                  placeholder="Enter"
                />
              </label>

              <div className="runner-actions">
                <button
                  className="button button--muted"
                  type="button"
                  disabled={harnessBusy || !harnessSession}
                  onClick={() => void handleHarnessPress()}
                >
                  Press key
                </button>
              </div>

              {harnessError ? (
                <p className="runner-error" role="alert">
                  {harnessError}
                </p>
              ) : null}
            </form>

            <article className="runner-card">
              <div className="runner-status">
                <span
                  className={`provider provider--${
                    harnessSession?.status ?? 'idle'
                  }`}
                >
                  {formatHarnessStatus(harnessSession)}
                </span>
                <p>
                  {harnessSession
                    ? harnessSession.bodyTextExcerpt ||
                      'Grecko attached the harness and is ready to use the app.'
                    : 'No harness session yet. Launch the app, then attach the no-integration harness.'}
                </p>
              </div>

              <dl className="facts facts--runner">
                <div>
                  <dt>Target</dt>
                  <dd>{harnessSession?.targetUrl ?? 'Not attached'}</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>{harnessSession?.mode ?? harnessMode}</dd>
                </div>
                <div>
                  <dt>Title</dt>
                  <dd>{harnessSession?.title ?? '—'}</dd>
                </div>
                <div>
                  <dt>Buttons</dt>
                  <dd>{harnessSession?.buttons.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Fields</dt>
                  <dd>{harnessSession?.fields.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Actions</dt>
                  <dd>{harnessSession?.interactionCount ?? 0}</dd>
                </div>
                <div>
                  <dt>{harnessSession?.mode === 'android' ? 'Current focus' : 'Current URL'}</dt>
                  <dd>{harnessSession?.currentUrl ?? '—'}</dd>
                </div>
              </dl>

              <div className="harness-controls">
                {harnessSession?.buttons.length ? (
                  harnessSession.buttons.slice(0, 8).map((button) => (
                    <button
                      key={button.index}
                      className="button button--muted"
                      type="button"
                      disabled={harnessBusy}
                      onClick={() => void handleHarnessClick(button.index)}
                    >
                      {button.text}
                    </button>
                  ))
                ) : (
                  <p className="helper">
                    No clickable controls discovered yet. Refresh the harness
                    after the app finishes loading.
                  </p>
                )}
              </div>

              {harnessSession?.screenshotDataUrl ? (
                <img
                  className="harness-screenshot"
                  src={harnessSession.screenshotDataUrl}
                  alt="Live app harness snapshot"
                />
              ) : null}

              <pre className="runner-log">
                {harnessSession?.logs.join('\n') ||
                  'No harness logs yet.'}
              </pre>
            </article>
          </div>
        </section>

        <section className="panel panel--bridge" id="bridge">
          <div className="panel__header">
            <p className="eyebrow">MCP bridge</p>
            <h2>Inspect optional deep Tauri bridge readiness</h2>
          </div>

          <div className="runner-grid">
            <form
              className="runner-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleBridgeCheck()
              }}
            >
              <label className="field" htmlFor={bridgePortId}>
                <span>Driver port</span>
                <input
                  id={bridgePortId}
                  name="bridge-port"
                  type="text"
                  value={bridgePort}
                  onChange={(event) => setBridgePort(event.target.value)}
                  placeholder={defaultBridgePort}
                />
              </label>

              <p className="helper">
                Grecko uses the published `tauri-mcp` CLI if it is installed,
                otherwise it falls back to `npx --package @hypothesi/tauri-mcp-cli tauri-mcp`.
              </p>

              <div className="runner-actions">
                <button
                  className="button button--muted"
                  type="submit"
                  disabled={bridgeBusy}
                >
                  {bridgeBusy ? 'Working...' : 'Check bridge'}
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={bridgeBusy}
                  onClick={() => void handleBridgeStart()}
                >
                  Start bridge session
                </button>
                <button
                  className="button button--muted"
                  type="button"
                  disabled={bridgeBusy || !bridgeSession}
                  onClick={() => void handleBridgeStop()}
                >
                  Stop bridge session
                </button>
              </div>

              {bridgeError ? (
                <p className="runner-error" role="alert">
                  {bridgeError}
                </p>
              ) : null}
            </form>

            <article className="runner-card">
              <div className="runner-status">
                <span
                  className={`provider provider--${
                    bridgeSession?.status ?? 'idle'
                  }`}
                >
                  {formatBridgeStatus(bridgeSession)}
                </span>
                <p>
                  {bridgeSession?.setupSummary ??
                    'No bridge inspection yet. Check the target repo first.'}
                </p>
              </div>

              <dl className="facts facts--runner">
                <div>
                  <dt>Setup</dt>
                  <dd>{bridgeSession?.setupDetected ? 'Detected' : 'Missing'}</dd>
                </div>
                <div>
                  <dt>Connected</dt>
                  <dd>{bridgeSession?.connected ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt>Port</dt>
                  <dd>{bridgeSession?.port ?? bridgePort}</dd>
                </div>
                <div>
                  <dt>Host</dt>
                  <dd>{bridgeSession?.host ?? '—'}</dd>
                </div>
                <div>
                  <dt>Identifier</dt>
                  <dd>{bridgeSession?.identifier ?? '—'}</dd>
                </div>
                <div>
                  <dt>CLI</dt>
                  <dd>{bridgeSession?.command ?? 'Not checked yet'}</dd>
                </div>
              </dl>

              <pre className="runner-log">
                {bridgeSession?.logs.join('\n') ||
                  'No bridge logs yet. For Stonefruit today, this should report that the MCP bridge plugin is not installed.'}
              </pre>
            </article>
          </div>
        </section>

        <section className="panel panel--findings" id="dossier">
          <div className="panel__header">
            <p className="eyebrow">Dossier</p>
            <h2>What the latest intake run actually resolved</h2>
          </div>

          {activeRun ? (
            <>
              <div className="findings">
                {dossierEntries.map((finding) => (
                  <article key={finding.title} className="finding">
                    <div className="finding__meta">
                      <span>{finding.severity}</span>
                      <span>{finding.label}</span>
                    </div>
                    <h3>{finding.title}</h3>
                    <p>{finding.evidence}</p>
                  </article>
                ))}
              </div>

              {activeRun.execution ? (
                <div className="execution-grid">
                  <article className="finding">
                    <div className="finding__meta">
                      <span>EXEC</span>
                      <span>{activeRun.stages.launch}</span>
                    </div>
                    <h3>Launch evidence</h3>
                    <p>
                      {activeRun.execution.command} in {activeRun.execution.cwd}
                    </p>
                    <p>
                      {activeRun.execution.target === 'android'
                        ? formatAndroidLaunchStatus(activeRun.execution.android)
                        : activeRun.execution.runner
                          ? `${formatRunnerStatus(activeRun.execution.runner)} with PID ${activeRun.execution.runner.pid ?? 'unknown'}.`
                          : 'No runner evidence has been recorded yet.'}
                    </p>
                  </article>

                  <article className="finding">
                    <div className="finding__meta">
                      <span>WEB</span>
                      <span>{activeRun.stages.harness}</span>
                    </div>
                    <h3>No-integration harness</h3>
                    <p>
                      {activeRun.execution.harness?.title
                        ? `${activeRun.execution.harness.title} via ${activeRun.execution.harness.currentUrl}`
                        : 'No no-integration harness evidence has been recorded yet.'}
                    </p>
                    <p>
                      {activeRun.execution.harness
                        ? `${activeRun.execution.harness.buttons.length} controls, ${activeRun.execution.harness.fields.length} fields, ${activeRun.execution.harness.interactionCount} actions.`
                        : 'Attach the no-integration harness to use the app without any target-side plugin.'}
                    </p>
                  </article>

                  <article className="finding">
                    <div className="finding__meta">
                      <span>BRIDGE</span>
                      <span>{activeRun.stages.bridge}</span>
                    </div>
                    <h3>Bridge evidence</h3>
                    <p>
                      {activeRun.execution.bridge?.setupSummary ??
                        'No bridge evidence has been recorded yet.'}
                    </p>
                    <p>
                      {activeRun.execution.bridge
                        ? `Driver port ${activeRun.execution.port} · connected ${activeRun.execution.bridge.connected ? 'yes' : 'no'}`
                        : `Driver port ${activeRun.execution.port}`}
                    </p>
                  </article>
                </div>
              ) : (
                <p className="helper">
                  No execution evidence yet. Run the active case file to attach
                  launch and bridge results to this dossier.
                </p>
              )}

              <div className="asset-table">
                {activeRun.release.assets.map((asset) => (
                  <article key={asset.url} className="asset-table__row">
                    <strong>{asset.name}</strong>
                    <span>{asset.kind}</span>
                    <a href={asset.url} target="_blank" rel="noreferrer">
                      Open asset
                    </a>
                  </article>
                ))}
              </div>

              <ul className="notes">
                {activeRun.verdict.reasonCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="helper">
              No real run dossier yet. Create a run to see resolved release
              assets, target status, and deterministic intake reason codes.
            </p>
          )}
        </section>

        <section className="panel panel--harnesses" id="harnesses">
          <div className="panel__header">
            <p className="eyebrow">Harness strategy</p>
            <h2>How the first Grecko harness stack fits together</h2>
          </div>

          <div className="pillars">
            {launchPillars.map((pillar) => (
              <article key={pillar.title} className="pillar">
                <p className="eyebrow">{pillar.eyebrow}</p>
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
              </article>
            ))}
          </div>

          <div className="command-card">
            <p className="eyebrow">Tauri MCP setup</p>
            <code>npx -y install-mcp @hypothesi/tauri-mcp-server --client claude-code</code>
            <p>
              The integration notes in this repo treat the Hypothesi server as
              the default bridge for app screenshots, DOM snapshots, logs, and
              IPC-aware debugging.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
