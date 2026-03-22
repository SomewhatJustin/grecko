import { describe, expect, it } from 'vitest'
import {
  computeIntakeVerdict,
  normalizeGitHubRelease,
  normalizeGitLabRelease,
} from './release-resolver.js'

describe('normalizeGitLabRelease', () => {
  it('selects Linux and Android assets from a GitLab release payload', () => {
    const release = normalizeGitLabRelease(
      {
        provider: 'gitlab',
        host: 'gitlab.futo.org',
        projectPath: 'stonefruit/stonefruit',
        repositoryUrl: 'https://gitlab.futo.org/stonefruit/stonefruit',
        releasePageUrl: 'https://gitlab.futo.org/stonefruit/stonefruit/-/releases',
      },
      {
        name: 'Stonefruit v1.0.5',
        tag_name: 'v1.0.5',
        released_at: '2026-03-20T16:53:19.419Z',
        description: 'Stonefruit release v1.0.5',
        assets: {
          links: [
            {
              name: 'Stonefruit-1.0.5-x86_64.AppImage',
              direct_asset_url:
                'https://gitlab.futo.org/api/v4/projects/488/packages/generic/stonefruit/v1.0.5/Stonefruit-1.0.5-x86_64.AppImage',
            },
            {
              name: 'stonefruit-1.0.5.apk',
              direct_asset_url:
                'https://gitlab.futo.org/api/v4/projects/488/packages/generic/stonefruit/v1.0.5/stonefruit-1.0.5.apk',
            },
          ],
          sources: [],
        },
      },
    )

    expect(release.selectedAssets.linux?.name).toContain('AppImage')
    expect(release.selectedAssets.android?.name).toContain('.apk')
  })
})

describe('normalizeGitHubRelease', () => {
  it('normalizes GitHub release assets', () => {
    const release = normalizeGitHubRelease(
      {
        provider: 'github',
        host: 'github.com',
        owner: 'acme',
        repo: 'grecko',
        projectPath: 'acme/grecko',
        repositoryUrl: 'https://github.com/acme/grecko',
        releasePageUrl: 'https://github.com/acme/grecko/releases',
      },
      {
        name: 'Grecko 0.1.0',
        tag_name: 'v0.1.0',
        published_at: '2026-03-20T16:53:19.419Z',
        body: 'First release',
        zipball_url: 'https://api.github.com/repos/acme/grecko/zipball/v0.1.0',
        tarball_url: 'https://api.github.com/repos/acme/grecko/tarball/v0.1.0',
        assets: [
          {
            name: 'grecko-linux-x86_64.AppImage',
            browser_download_url: 'https://github.com/acme/grecko/releases/download/v0.1.0/grecko-linux-x86_64.AppImage',
          },
          {
            name: 'grecko-universal.apk',
            browser_download_url: 'https://github.com/acme/grecko/releases/download/v0.1.0/grecko-universal.apk',
          },
        ],
      },
    )

    expect(release.selectedAssets.linux?.kind).toBe('linux')
    expect(release.selectedAssets.android?.kind).toBe('android')
  })
})

describe('computeIntakeVerdict', () => {
  it('blocks when required assets are missing', () => {
    const verdict = computeIntakeVerdict({
      targetStatuses: [
        { target: 'linux', status: 'ready' },
        { target: 'android', status: 'missing' },
      ],
    })

    expect(verdict.label).toBe('block')
    expect(verdict.reasonCodes).toContain('MISSING_ANDROID_ASSET')
  })

  it('marks complete intake as investigate until execution runs happen', () => {
    const verdict = computeIntakeVerdict({
      targetStatuses: [
        { target: 'linux', status: 'ready' },
        { target: 'android', status: 'ready' },
      ],
    })

    expect(verdict.label).toBe('investigate')
    expect(verdict.reasonCodes).toContain('INTAKE_READY')
  })
})
