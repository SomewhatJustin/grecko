import { describe, expect, it } from 'vitest'
import { detectHarnessTargetUrl, extractLocalUrls } from './harness-store.js'

describe('extractLocalUrls', () => {
  it('finds localhost app URLs in runner logs', () => {
    const urls = extractLocalUrls(`
      [stdout] Local: http://127.0.0.1:5180/
      [stdout] Network: use --host to expose
      [stdout] Secondary: http://localhost:4173/path
    `)

    expect(urls).toEqual([
      'http://127.0.0.1:5180/',
      'http://localhost:4173/path',
    ])
  })
})

describe('detectHarnessTargetUrl', () => {
  it('picks the first detected local URL from a runner session', () => {
    const url = detectHarnessTargetUrl({
      logs: [
        '[stdout] VITE ready',
        '[stdout] Local: http://127.0.0.1:5180/',
        '[stderr] Running target/debug/futo-notes-tauri',
      ],
    })

    expect(url).toBe('http://127.0.0.1:5180/')
  })
})
