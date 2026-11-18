import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Profile } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { messagesFor } from '../src/core/i18n/index.ts'
import { paths } from '../src/core/paths.ts'
import { renderProfilePicker } from '../src/features/hooks/profile-picker.ts'
import { applyProfilePicker } from '../src/features/setup/install.ts'
import { validateAlias, withProfilePicker } from '../src/features/setup/profiles.ts'
import { useTempHome } from './helpers.ts'

const home = useTempHome()

const profiles: Profile[] = [
  { id: 'work', name: 'Trabalho', configDir: '/Users/u/.claude-work', color: '' },
  { id: 'personal', name: 'Pessoal', configDir: '/Users/u/.claude', color: '' },
  { id: 'cx', name: 'Empresa X', configDir: '/Users/u/.codex-x', color: '', agent: 'codex' },
]

/** The picker next to fake launchers that each record their alias, folder and arguments. */
async function install(list: readonly Profile[], locale: 'en-US' | 'pt-BR' = 'en-US') {
  const bin = join(home.dir(), 'bin')
  await mkdir(bin, { recursive: true })
  const ran = join(home.dir(), 'ran.txt')
  for (const p of list) {
    await writeFile(
      join(bin, p.id),
      `#!/bin/sh\nprintf '%s|%s|%s\\n' '${p.id}' "$(pwd -P)" "$*" > '${ran}'\n`,
      {
        mode: 0o755,
      },
    )
  }
  const picker = join(bin, 'rhnss')
  const labels = messagesFor(locale).install.profilePicker
  await writeFile(picker, renderProfilePicker(list, { home: '/Users/u', labels }), { mode: 0o755 })
  const project = join(home.dir(), 'my api')
  await mkdir(project, { recursive: true })
  const run = (args: string[], input = '') => {
    const result = spawnSync(picker, args, { input, cwd: project, encoding: 'utf8' })
    return { status: result.status, out: `${result.stdout}${result.stderr}` }
  }
  const launched = () =>
    readFile(ran, 'utf8').then(
      (s) => s.trim(),
      () => null,
    )
  return { picker, run, launched, project: await realpath(project) }
}

describe('profile picker (rhnss)', () => {
  test('is valid zsh, generated, and lists agent · name · folder in aligned columns', async () => {
    const script = renderProfilePicker(profiles, {
      home: '/Users/u',
      labels: messagesFor('en-US').install.profilePicker,
    })
    execFileSync('zsh', ['-n', '-c', script])
    expect(script).toMatch(/^#!\/usr\/bin\/env zsh\n/)
    expect(script).toContain('do not edit')
    const { run } = await install(profiles)
    const { out } = run([], '\n')
    expect(out).toContain('Which profile do you want to start?')
    expect(out).toContain('  1) Claude Code | Trabalho  | ~/.claude-work\n')
    expect(out).toContain('  2) Claude Code | Pessoal   | ~/.claude\n')
    expect(out).toContain('  3) Codex       | Empresa X | ~/.codex-x\n')
  })

  test('a number or an alias starts that launcher with every argument, in the current folder', async () => {
    const { run, launched, project } = await install(profiles)
    expect(run(['--resume', 'abc 1'], '3\n').status).toBe(0)
    expect(await launched()).toBe(`cx|${project}|--resume abc 1`)
    expect(run(['-c'], 'personal\n').status).toBe(0)
    expect(await launched()).toBe(`personal|${project}|-c`)
  })

  test('an alias on the command line starts it without asking', async () => {
    const { run, launched, project } = await install(profiles)
    const { status, out } = run(['work', '--continue'])
    expect(status).toBe(0)
    expect(out).not.toContain('Which profile')
    expect(await launched()).toBe(`work|${project}|--continue`)
  })

  test('a single profile starts at once', async () => {
    const { run, launched, project } = await install(profiles.slice(1, 2))
    const { status, out } = run(['--resume'])
    expect(status).toBe(0)
    expect(out).toBe('')
    expect(await launched()).toBe(`personal|${project}|--resume`)
  })

  test('an answer out of the list asks again; Enter or end of input starts nothing', async () => {
    const { run, launched, project } = await install(profiles)
    const again = run([], '7\nnope\n2\n')
    expect(again.status).toBe(0)
    expect(again.out.match(/Type a number from 1 to 3/g)).toHaveLength(2)
    expect(await launched()).toBe(`personal|${project}|`)
    const fresh = await install(profiles)
    await writeFile(join(home.dir(), 'ran.txt'), '')
    expect(fresh.run([], '\n').status).toBe(1)
    expect(fresh.run([], '').status).toBe(1)
    expect(await fresh.launched()).toBe('')
  })

  test('texts follow the language it was written in', async () => {
    const { run } = await install(profiles, 'pt-BR')
    const { out } = run([], '9\n\n')
    expect(out).toContain('Qual perfil você quer iniciar?')
    expect(out).toContain('Número (1-3): ')
    expect(out).toContain('Digite um número de 1 a 3')
  })
})

describe('profile picker install', () => {
  const m = messagesFor('en-US').install
  const picker = () => join(paths.bin(), 'rhnss')

  test('written with the current profiles when on, rewritten when they change, removed when off', async () => {
    expect(await applyProfilePicker({ profilePicker: true }, profiles.slice(0, 2), m)).toEqual([
      { status: 'done', text: `profile picker ${picker()}` },
    ])
    expect((await stat(picker())).mode & 0o777).toBe(0o755)
    expect(await readFile(picker(), 'utf8')).not.toContain("'cx'")
    // A profile added later shows up on the next install, setup or update.
    await applyProfilePicker({ profilePicker: true }, profiles, m)
    expect(await readFile(picker(), 'utf8')).toContain("ids=('work' 'personal' 'cx')")
    expect(await applyProfilePicker({ profilePicker: false }, profiles, m)).toEqual([
      { status: 'done', text: `profile picker ${picker()} removed` },
    ])
    expect(existsSync(picker())).toBe(false)
    // Off and absent: nothing to say.
    expect(await applyProfilePicker({ profilePicker: false }, profiles, m)).toEqual([])
  })

  test('never replaces the launcher of a profile that took the name (config edited by hand)', async () => {
    const own: Profile = { id: 'rhnss', name: 'R', configDir: '/Users/u/.claude-r', color: '' }
    await mkdir(paths.bin(), { recursive: true })
    await writeFile(picker(), 'launcher', { mode: 0o755 })
    expect(await applyProfilePicker({ profilePicker: true }, [...profiles, own], m)).toEqual([])
    expect(await applyProfilePicker({ profilePicker: false }, [...profiles, own], m)).toEqual([])
    expect(await readFile(picker(), 'utf8')).toBe('launcher')
  })

  test('rhnss is a reserved alias', () => {
    expect(validateAlias('rhnss', [], messagesFor('en-US').profiles)).toContain('reserved')
  })

  test('the setup answer is merged into the raw config, keeping every other key', () => {
    expect(withProfilePicker({ wsPort: 9000, profiles: [] }, true)).toEqual({
      wsPort: 9000,
      profiles: [],
      profilePicker: true,
    })
    expect(withProfilePicker({ profilePicker: true }, false)).toEqual({ profilePicker: false })
  })
})
