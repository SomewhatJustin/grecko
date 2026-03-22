import { describe, expect, it } from 'vitest'
import {
  detectReleaseProvider,
  stonefruitReleaseUrl,
  validateReleaseIntake,
} from './release-intake'

describe('detectReleaseProvider', () => {
  it('detects GitLab release pages', () => {
    expect(detectReleaseProvider(stonefruitReleaseUrl)).toBe('gitlab')
  })

  it('detects GitHub release pages', () => {
    expect(
      detectReleaseProvider('https://github.com/owner/project/releases/tag/v1.2.3'),
    ).toBe('github')
  })

  it('rejects unsupported URLs', () => {
    expect(detectReleaseProvider('https://example.com/releases')).toBe('unsupported')
    expect(detectReleaseProvider('not a url')).toBe('unsupported')
  })
})

describe('validateReleaseIntake', () => {
  it('returns a GitLab-specific message for the seeded release', () => {
    expect(validateReleaseIntake(stonefruitReleaseUrl)).toEqual({
      headline: 'GitLab release detected',
      detail:
        'This matches the Stonefruit-style intake Grecko should use for early real-world release testing.',
    })
  })
})
