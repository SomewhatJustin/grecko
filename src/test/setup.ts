import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (url.includes('/api/runs')) {
        return {
          ok: true,
          json: async () => ({ runs: [] }),
        }
      }

      return {
        ok: true,
        json: async () => ({ session: null }),
      }
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})
