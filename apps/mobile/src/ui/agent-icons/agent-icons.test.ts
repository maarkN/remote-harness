import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { hasRegisteredIcon, REGISTERED_ICON_IDS } from './ids'
import { CLAUDE_PATH } from './paths'

describe('Claude mark', () => {
  test('draws the same path as the landing', () => {
    const landing = readFileSync(new URL('../../../../web/src/agent-marks.ts', import.meta.url), 'utf8')
    expect(landing).toContain(`<path d="${CLAUDE_PATH}">`)
  })
})

describe('hasRegisteredIcon', () => {
  test('true for every known agent and provider id', () => {
    for (const id of REGISTERED_ICON_IDS) expect(hasRegisteredIcon(id)).toBe(true)
    expect(REGISTERED_ICON_IDS).toEqual(['claude', 'codex', 'kimi', 'qwen', 'openrouter'])
  })

  test('false for an id without a registered icon', () => {
    expect(hasRegisteredIcon('some-future-agent')).toBe(false)
  })
})
