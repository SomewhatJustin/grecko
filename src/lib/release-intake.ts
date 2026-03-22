export type ReleaseProvider = 'github' | 'gitlab' | 'unsupported'

export const stonefruitReleaseUrl =
  'https://gitlab.futo.org/stonefruit/stonefruit/-/releases'

function safelyParseUrl(candidate: string) {
  try {
    return new URL(candidate.trim())
  } catch {
    return null
  }
}

export function detectReleaseProvider(candidate: string): ReleaseProvider {
  const parsed = safelyParseUrl(candidate)
  if (!parsed) {
    return 'unsupported'
  }

  if (parsed.hostname === 'github.com' && parsed.pathname.includes('/releases')) {
    return 'github'
  }

  if (parsed.pathname.includes('/-/releases')) {
    return 'gitlab'
  }

  return 'unsupported'
}

export function validateReleaseIntake(candidate: string) {
  const provider = detectReleaseProvider(candidate)

  if (provider === 'github') {
    return {
      headline: 'GitHub release detected',
      detail:
        'Grecko can normalize GitHub release pages into artifact candidates and runner context.',
    }
  }

  if (provider === 'gitlab') {
    return {
      headline: 'GitLab release detected',
      detail:
        'This matches the Stonefruit-style intake Grecko should use for early real-world release testing.',
    }
  }

  return {
    headline: 'Unsupported release URL',
    detail:
      'Grecko currently expects a public GitHub or GitLab release page so it can discover artifacts without custom repo wiring.',
  }
}
