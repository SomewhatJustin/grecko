import { useEffect, useId, useState } from 'react'
import './App.css'
import {
  detectReleaseProvider,
  stonefruitReleaseUrl,
  validateReleaseIntake,
} from './lib/release-intake'
import {
  fetchRunnerSession,
  startRunnerSession,
  stopRunnerSession,
  type RunnerSession,
} from './lib/runner-client'

const runSnapshot = {
  verdict: 'investigate',
  reason:
    'Coverage incomplete on Android while Linux passed and found a new regression.',
  baseline:
    'Compared against the last known good stable build for Linux and Android.',
  referenceRelease: stonefruitReleaseUrl,
  platforms: [
    {
      name: 'Linux',
      state: 'ready',
      summary:
        'Window lifecycle smoke passed. One new close-behavior regression captured.',
    },
    {
      name: 'Android',
      state: 'pending',
      summary:
        'Webview boot is still running. Overall verdict stays gated until coverage resolves.',
    },
  ],
  findings: [
    {
      severity: 'P1',
      title: 'Main window close action no longer exits cleanly on Linux',
      label: 'new regression',
      evidence:
        'Video, console trace, and IPC timeline all point at the same quit-path failure.',
    },
    {
      severity: 'P2',
      title: 'Keyboard toolbar crowding appears on compact Android heights',
      label: 'watch closely',
      evidence:
        'Viewport capture shows safe-area overlap once the keyboard opens.',
    },
    {
      severity: 'P3',
      title: 'Paste flow needs a targeted iOS follow-up harness',
      label: 'deferred platform',
      evidence:
        'Kept visible in the dossier, but outside the Linux + Android starter envelope.',
    },
  ],
} as const

const launchPillars = [
  {
    eyebrow: 'Artifact intake',
    title: 'Start from a public release URL',
    body:
      'Grecko begins with release pages because that is the fastest path to real artifacts and real confidence. The seeded example is the Stonefruit GitLab releases page you supplied.',
  },
  {
    eyebrow: 'Harness access',
    title: 'Use the Tauri MCP bridge for deep app control',
    body:
      'The Hypothesi MCP server gives AI harnesses screenshots, DOM state, logs, IPC visibility, and device discovery, which maps directly onto the kind of evidence Grecko needs.',
  },
  {
    eyebrow: 'Decision layer',
    title: 'Return ship, investigate, or block',
    body:
      'The product direction is a release judge, not a raw log bucket. Every run should end in an explicit verdict with reason codes and evidence.',
  },
] as const

const dossierNotes = [
  'Coverage stays pending until each required platform either completes or fails explicitly.',
  'Baseline comparisons name what is actually new instead of resurfacing known history as fake urgency.',
  'Evidence bundles stay useful even when one artifact is missing, as long as the warning is explicit.',
] as const

const defaultRunnerCommand = 'npm run tauri dev'
const defaultRunnerDirectory = '/home/justin/Developer/stonefruit'

function formatRunnerStatus(session: RunnerSession | null) {
  if (!session) {
    return 'Runner idle'
  }

  switch (session.status) {
    case 'running':
      return 'App running'
    case 'stopped':
      return 'Stopped'
    case 'failed':
      return 'Launch failed'
    case 'exited':
      return 'Exited cleanly'
  }
}

function App() {
  const intakeId = useId()
  const runnerCommandId = useId()
  const runnerDirectoryId = useId()
  const [releaseUrl, setReleaseUrl] = useState(stonefruitReleaseUrl)
  const [runnerCommand, setRunnerCommand] = useState(defaultRunnerCommand)
  const [runnerDirectory, setRunnerDirectory] = useState(defaultRunnerDirectory)
  const [runnerSession, setRunnerSession] = useState<RunnerSession | null>(null)
  const [runnerError, setRunnerError] = useState('')
  const [runnerBusy, setRunnerBusy] = useState(false)

  const intake = validateReleaseIntake(releaseUrl)
  const provider = detectReleaseProvider(releaseUrl)

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

  useEffect(() => {
    void refreshRunner()
  }, [])

  useEffect(() => {
    if (runnerSession?.status !== 'running') {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshRunner(false)
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [runnerSession?.id, runnerSession?.status])

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
              <h2>Release page intake</h2>
            </div>

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

            <dl className="facts">
              <div>
                <dt>Seed release</dt>
                <dd>Stonefruit GitLab releases</dd>
              </div>
              <div>
                <dt>Supported today</dt>
                <dd>Public GitHub and GitLab release pages</dd>
              </div>
              <div>
                <dt>Next step</dt>
                <dd>Persist asset selection rules once release pages get ambiguous</dd>
              </div>
            </dl>
          </article>

          <article className="panel panel--verdict">
            <div className="panel__header">
              <p className="eyebrow">Run verdict</p>
              <h2>Current control-room snapshot</h2>
            </div>

            <div className="verdict-strip">
              <span className="verdict verdict--investigate">
                {runSnapshot.verdict}
              </span>
              <p>{runSnapshot.reason}</p>
            </div>

            <p className="baseline">{runSnapshot.baseline}</p>
            <p className="reference">
              Reference run target:{' '}
              <a href={runSnapshot.referenceRelease} target="_blank" rel="noreferrer">
                {runSnapshot.referenceRelease}
              </a>
            </p>

            <div className="platforms" aria-label="Platform run states">
              {runSnapshot.platforms.map((platform) => (
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
                on your machine. Start with a Tauri dev command inside the target
                project directory.
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

        <section className="panel panel--findings" id="dossier">
          <div className="panel__header">
            <p className="eyebrow">Findings dossier</p>
            <h2>What the release packet should surface first</h2>
          </div>

          <div className="findings">
            {runSnapshot.findings.map((finding) => (
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

          <ul className="notes">
            {dossierNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
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
