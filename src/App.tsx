import { useId, useState } from 'react'
import './App.css'
import {
  detectReleaseProvider,
  stonefruitReleaseUrl,
  validateReleaseIntake,
} from './lib/release-intake'

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

function App() {
  const inputId = useId()
  const [releaseUrl, setReleaseUrl] = useState(stonefruitReleaseUrl)

  const intake = validateReleaseIntake(releaseUrl)
  const provider = detectReleaseProvider(releaseUrl)

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

            <label className="field" htmlFor={inputId}>
              <span>Public release URL</span>
              <input
                id={inputId}
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
