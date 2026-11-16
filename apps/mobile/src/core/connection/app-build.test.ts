import { AppBuildSchema } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { appBuildOf } from './app-build'

describe('appBuildOf (#591)', () => {
  test('the version, runtime and OTA update that run', () => {
    expect(
      appBuildOf({
        version: '1.2.2',
        runtimeVersion: 'a1b2c3',
        updateId: '0199f2d4-1c2b-7a3e-9b1f-2a3c4d5e6f70',
      }),
    ).toEqual({ version: '1.2.2', runtime: 'a1b2c3', update: '0199f2d4-1c2b-7a3e-9b1f-2a3c4d5e6f70' })
  })

  test('the embedded bundle has no update; empty values are dropped; no version, no build', () => {
    expect(appBuildOf({ version: '1.2.2', runtimeVersion: '', updateId: null })).toEqual({ version: '1.2.2' })
    expect(appBuildOf({ version: ' ', runtimeVersion: 'a1' })).toBeUndefined()
    expect(appBuildOf({})).toBeUndefined()
  })

  test('long values are cut so the daemon never drops the build', () => {
    const build = appBuildOf({
      version: '1'.repeat(40),
      runtimeVersion: 'r'.repeat(80),
      updateId: 'u'.repeat(80),
    })
    expect(AppBuildSchema.safeParse(build).success).toBe(true)
  })
})
