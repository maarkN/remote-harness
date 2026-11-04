import { lstat, mkdir, readFile, readlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { envVar } from '../src/core/env.ts'
import { dataHome, migrateLegacyDataDir } from '../src/core/paths.ts'
import { useTempHome } from './helpers.ts'

const home = useTempHome()

describe('envVar', () => {
  test('prefers REMOTE_HARNESS_*, then the legacy CLAUDE_REMOTE_* name', () => {
    expect(envVar('REF', { REMOTE_HARNESS_REF: 'a', CLAUDE_REMOTE_REF: 'b' })).toBe('a')
    expect(envVar('REF', { CLAUDE_REMOTE_REF: 'b' })).toBe('b')
    expect(envVar('REF', { REMOTE_HARNESS_REF: '', CLAUDE_REMOTE_REF: 'b' })).toBe('b')
    expect(envVar('REF', {})).toBeUndefined()
  })
})

describe('dataHome', () => {
  test('honors the override, new or legacy name', () => {
    expect(dataHome({ REMOTE_HARNESS_HOME: '/d' }, '/h')).toBe('/d')
    expect(dataHome({ CLAUDE_REMOTE_HOME: '/legacy' }, '/h')).toBe('/legacy')
  })

  test('is ~/.remote-harness without an override', () => {
    expect(dataHome({}, '/h')).toBe('/h/.remote-harness')
  })
})

describe('migrateLegacyDataDir', () => {
  test('moves ~/.claude-remote to ~/.remote-harness once and leaves a link at the old path', async () => {
    const h = home.dir()
    await mkdir(join(h, '.claude-remote'))
    await writeFile(join(h, '.claude-remote', 'config.json'), '{}')
    expect(migrateLegacyDataDir({}, h)).toBe(join(h, '.remote-harness'))
    expect(await readFile(join(h, '.remote-harness', 'config.json'), 'utf8')).toBe('{}')
    expect(await readlink(join(h, '.claude-remote'))).toBe(join(h, '.remote-harness'))
    // The old path is a link now: nothing more to do.
    expect(migrateLegacyDataDir({}, h)).toBeNull()
  })

  test('moves nothing without the old directory, with the override, or when the new path is taken', async () => {
    const h = home.dir()
    expect(migrateLegacyDataDir({}, h)).toBeNull()
    await mkdir(join(h, '.claude-remote'))
    expect(migrateLegacyDataDir({ REMOTE_HARNESS_HOME: '/x' }, h)).toBeNull()
    await mkdir(join(h, '.remote-harness'))
    expect(migrateLegacyDataDir({}, h)).toBeNull()
    expect((await lstat(join(h, '.claude-remote'))).isDirectory()).toBe(true)
  })
})
