import { describe, expect, test } from 'vitest'
import { screenshotBuild } from './screenshot-build'

describe('screenshotBuild', () => {
  test('is on only when app.config.ts put the flag in extra', () => {
    expect(screenshotBuild({ screenshots: true })).toBe(true)
    expect(screenshotBuild({ firebase: { ios: true }, screenshots: true })).toBe(true)
  })

  test('is off for ordinary builds and for anything that is not the flag', () => {
    expect(screenshotBuild(undefined)).toBe(false)
    expect(screenshotBuild(null)).toBe(false)
    expect(screenshotBuild({})).toBe(false)
    expect(screenshotBuild({ firebase: { ios: true } })).toBe(false)
    expect(screenshotBuild({ screenshots: 'true' })).toBe(false)
    expect(screenshotBuild({ screenshots: 1 })).toBe(false)
    expect(screenshotBuild('screenshots')).toBe(false)
  })
})
