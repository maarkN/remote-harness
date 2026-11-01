import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { renameProfileInConfig, withProfileName } from '../src/core/config.ts'

describe('withProfileName', () => {
  const profiles = [
    { id: 'work', name: 'Work', configDir: '~/.claude-work', color: '#61afef' },
    { id: 'personal', name: 'Personal', configDir: '~/.claude', color: '#e8a33d' },
  ]

  test('renames only the profile with that id, trimmed, keeping the rest as written', () => {
    expect(withProfileName(profiles, 'work', '  Acme ')).toEqual([
      { id: 'work', name: 'Acme', configDir: '~/.claude-work', color: '#61afef' },
      profiles[1],
    ])
  })

  test('refuses a blank name, an unknown id or a config without profiles', () => {
    expect(withProfileName(profiles, 'work', '   ')).toBeNull()
    expect(withProfileName(profiles, 'nope', 'Acme')).toBeNull()
    expect(withProfileName(undefined, 'work', 'Acme')).toBeNull()
  })
})

describe('renameProfileInConfig', () => {
  let dir: string | undefined
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  test('writes the new name to the config file with a backup', async () => {
    dir = await mkdtemp(join(tmpdir(), 'rh-profile-'))
    const path = join(dir, 'config.json')
    const original = { profiles: [{ id: 'work', name: 'Work', configDir: '~/.claude', color: '#fff' }] }
    await writeFile(path, JSON.stringify(original))
    expect(await renameProfileInConfig('work', 'Acme', path)).toBe(true)
    expect(JSON.parse(await readFile(path, 'utf8')).profiles[0]).toEqual({
      ...original.profiles[0],
      name: 'Acme',
    })
    expect(JSON.parse(await readFile(`${path}.bak-claude-remote`, 'utf8'))).toEqual(original)
    expect(await renameProfileInConfig('work', '', path)).toBe(false)
  })
})
