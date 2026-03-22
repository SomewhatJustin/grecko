function parseReleaseLocator(releaseUrl) {
  let parsed
  try {
    parsed = new URL(releaseUrl)
  } catch {
    throw new Error('Release URL must be a valid absolute URL.')
  }

  const pathname = parsed.pathname.replace(/\/+$/, '')

  if (parsed.hostname === 'github.com' && pathname.includes('/releases')) {
    const parts = pathname.split('/').filter(Boolean)
    const owner = parts[0]
    const repo = parts[1]
    const tagName = parts[3] === 'tag' ? decodeURIComponent(parts[4] ?? '') : null

    if (!owner || !repo) {
      throw new Error('GitHub release URLs must include owner and repository name.')
    }

    return {
      provider: 'github',
      host: parsed.hostname,
      owner,
      repo,
      tagName,
      releasePageUrl: parsed.toString(),
      projectPath: `${owner}/${repo}`,
      repositoryUrl: `${parsed.protocol}//${parsed.hostname}/${owner}/${repo}`,
    }
  }

  if (pathname.includes('/-/releases')) {
    const [projectPathPart, maybeReleasePath] = pathname.split('/-/releases')
    const projectPath = decodeURIComponent(projectPathPart.replace(/^\/+/, ''))
    const tagName = maybeReleasePath
      ? decodeURIComponent(maybeReleasePath.replace(/^\/+/, '').split('/')[0] ?? '')
      : null

    if (!projectPath) {
      throw new Error('GitLab release URLs must include the project path.')
    }

    return {
      provider: 'gitlab',
      host: parsed.hostname,
      projectPath,
      tagName,
      releasePageUrl: parsed.toString(),
      repositoryUrl: `${parsed.protocol}//${parsed.hostname}/${projectPath}`,
    }
  }

  throw new Error('Grecko currently supports only public GitHub and GitLab release URLs.')
}

function classifyAssetKind(name, url) {
  const candidate = `${name} ${url}`.toLowerCase()

  if (candidate.includes('.apk') || candidate.includes('.aab')) {
    return 'android'
  }

  if (
    candidate.includes('.appimage') ||
    candidate.includes('.deb') ||
    candidate.includes('.rpm')
  ) {
    return 'linux'
  }

  if (candidate.includes('.ipa')) {
    return 'ios'
  }

  if (candidate.includes('.dmg') || candidate.includes('.pkg')) {
    return 'macos'
  }

  if (candidate.includes('.msi') || candidate.includes('.exe')) {
    return 'windows'
  }

  if (
    candidate.includes('.zip') ||
    candidate.includes('.tar.gz') ||
    candidate.includes('.tar.bz2') ||
    candidate.includes('.tar')
  ) {
    return 'source'
  }

  return 'unknown'
}

function assetPreferenceScore(asset, target) {
  const candidate = `${asset.name} ${asset.url}`.toLowerCase()

  if (target === 'linux') {
    if (candidate.includes('.appimage')) return 300
    if (candidate.includes('.deb')) return 200
    if (candidate.includes('.rpm')) return 100
  }

  if (target === 'android') {
    if (candidate.includes('.apk')) return 300
    if (candidate.includes('.aab')) return 200
  }

  return 0
}

function pickPreferredAsset(assets, target) {
  const matches = assets.filter((asset) => asset.kind === target)
  if (matches.length === 0) {
    return null
  }

  return [...matches].sort(
    (left, right) => assetPreferenceScore(right, target) - assetPreferenceScore(left, target),
  )[0]
}

function summarizeNotes(description) {
  const normalized = (description ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return 'No release notes were provided.'
  }

  return normalized.slice(0, 220)
}

export function normalizeGitLabRelease(locator, release) {
  const assets = [
    ...(release.assets?.links ?? []).map((asset) => ({
      name: asset.name,
      url: asset.direct_asset_url ?? asset.url,
      kind: classifyAssetKind(asset.name, asset.direct_asset_url ?? asset.url),
      source: 'release_link',
    })),
    ...(release.assets?.sources ?? []).map((asset) => ({
      name: `${release.tag_name}.${asset.format}`,
      url: asset.url,
      kind: classifyAssetKind(asset.format, asset.url),
      source: 'source_archive',
    })),
  ]

  const selectedAssets = {
    linux: pickPreferredAsset(assets, 'linux'),
    android: pickPreferredAsset(assets, 'android'),
  }

  return buildNormalizedRelease(locator, {
    releaseName: release.name || release.tag_name,
    tagName: release.tag_name,
    publishedAt: release.released_at || release.created_at,
    notesExcerpt: summarizeNotes(release.description),
    assets,
    selectedAssets,
  })
}

export function normalizeGitHubRelease(locator, release) {
  const assets = [
    ...(release.assets ?? []).map((asset) => ({
      name: asset.name,
      url: asset.browser_download_url,
      kind: classifyAssetKind(asset.name, asset.browser_download_url),
      source: 'release_link',
    })),
    {
      name: `${release.tag_name}.zip`,
      url: release.zipball_url,
      kind: 'source',
      source: 'source_archive',
    },
    {
      name: `${release.tag_name}.tar.gz`,
      url: release.tarball_url,
      kind: 'source',
      source: 'source_archive',
    },
  ]

  const selectedAssets = {
    linux: pickPreferredAsset(assets, 'linux'),
    android: pickPreferredAsset(assets, 'android'),
  }

  return buildNormalizedRelease(locator, {
    releaseName: release.name || release.tag_name,
    tagName: release.tag_name,
    publishedAt: release.published_at || release.created_at,
    notesExcerpt: summarizeNotes(release.body),
    assets,
    selectedAssets,
  })
}

function buildNormalizedRelease(locator, payload) {
  const targetStatuses = ['linux', 'android'].map((target) => {
    const selected = payload.selectedAssets[target]

    return {
      target,
      status: selected ? 'ready' : 'missing',
      summary: selected
        ? `Selected ${selected.name} for ${target}.`
        : `No ${target} release artifact was found on the release page.`,
      selectedAsset: selected,
    }
  })

  return {
    provider: locator.provider,
    host: locator.host,
    projectPath: locator.projectPath,
    repositoryUrl: locator.repositoryUrl,
    releasePageUrl: locator.releasePageUrl,
    releaseName: payload.releaseName,
    tagName: payload.tagName,
    publishedAt: payload.publishedAt,
    notesExcerpt: payload.notesExcerpt,
    assets: payload.assets,
    selectedAssets: payload.selectedAssets,
    targetStatuses,
  }
}

export function computeIntakeVerdict(release) {
  const missingTargets = release.targetStatuses
    .filter((target) => target.status !== 'ready')
    .map((target) => target.target)

  if (missingTargets.length > 0) {
    return {
      label: 'block',
      reasonCodes: ['INTAKE_MISSING_REQUIRED_ASSET', ...missingTargets.map((target) => `MISSING_${target.toUpperCase()}_ASSET`)],
      summary: `Grecko could not find the full Linux + Android artifact set. Missing: ${missingTargets.join(', ')}.`,
    }
  }

  return {
    label: 'investigate',
    reasonCodes: ['INTAKE_READY', 'RUN_NOT_EXECUTED'],
    summary:
      'Release intake is complete and Grecko found Linux + Android artifacts, but execution evidence has not been collected yet.',
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init)

  if (!response.ok) {
    throw new Error(`Release provider request failed with ${response.status}.`)
  }

  return response.json()
}

async function resolveGitLabRelease(locator) {
  const encodedProject = encodeURIComponent(locator.projectPath)
  const base = `https://${locator.host}/api/v4/projects/${encodedProject}/releases`
  const url = locator.tagName ? `${base}/${encodeURIComponent(locator.tagName)}` : `${base}?per_page=1`
  const payload = await fetchJson(url)
  const release = Array.isArray(payload) ? payload[0] : payload

  if (!release) {
    throw new Error('No GitLab release could be resolved from that URL.')
  }

  return normalizeGitLabRelease(locator, release)
}

async function resolveGitHubRelease(locator) {
  const base = `https://api.github.com/repos/${locator.owner}/${locator.repo}/releases`
  const url = locator.tagName
    ? `${base}/tags/${encodeURIComponent(locator.tagName)}`
    : `${base}?per_page=1`
  const payload = await fetchJson(url, {
    headers: {
      'User-Agent': 'grecko',
      Accept: 'application/vnd.github+json',
    },
  })
  const release = Array.isArray(payload) ? payload[0] : payload

  if (!release) {
    throw new Error('No GitHub release could be resolved from that URL.')
  }

  return normalizeGitHubRelease(locator, release)
}

export async function resolveRelease(releaseUrl) {
  const locator = parseReleaseLocator(releaseUrl)

  if (locator.provider === 'gitlab') {
    return resolveGitLabRelease(locator)
  }

  return resolveGitHubRelease(locator)
}
