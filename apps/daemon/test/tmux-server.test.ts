import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'vitest'
import { ConfigSchema, DEFAULT_TMUX_SOCKET } from '../src/core/config.ts'
import { paths } from '../src/core/paths.ts'
import {
  ensureTmuxConf,
  legacySessionsExist,
  renameLegacySession,
  renderTmuxConf,
  tmuxServerOf,
  userTmuxConfs,
} from '../src/features/tmux-server/conf.ts'
import { TmuxClient, tmuxServerArgs } from '../src/infra/tmux.ts'
import { fakeExecutor, useTempHome } from './helpers.ts'

useTempHome()
const profiles = [{ id: 'p', name: 'P', configDir: '~/.claude', color: '#fff' }]

describe('tmux server config keys', () => {
  test('defaults to the remote-harness server with the minimal config', () => {
    const config = ConfigSchema.parse({ profiles })
    expect(config.tmuxSocket).toBe(DEFAULT_TMUX_SOCKET)
    expect(config.tmuxConfig).toBe('minimal')
    expect(tmuxServerOf(config)).toEqual({ socket: 'remote-harness', conf: paths.tmuxConf() })
  })

  test('null means the default server; an empty name or an unknown mode is refused', () => {
    expect(tmuxServerOf(ConfigSchema.parse({ profiles, tmuxSocket: null }))).toBeNull()
    expect(ConfigSchema.safeParse({ profiles, tmuxSocket: '' }).success).toBe(false)
    expect(ConfigSchema.safeParse({ profiles, tmuxConfig: 'mine' }).success).toBe(false)
  })
})

describe('TmuxClient server flags', () => {
  const server = { socket: 'remote-harness', conf: '/h/.remote-harness/tmux.conf' }

  test('select the server right after -u, before the command', async () => {
    const exec = fakeExecutor(() => ({ stdout: '' }))
    await new TmuxClient(exec, 'tmux', server).sendKeys('%1', ['Enter'])
    expect(exec.calls[0]?.rawArgs).toEqual([
      '-u',
      '-L',
      'remote-harness',
      '-f',
      '/h/.remote-harness/tmux.conf',
      'send-keys',
      '-t',
      '%1',
      'Enter',
    ])
    expect(new TmuxClient(exec, 'tmux', server).server).toEqual(server)
  })

  test('the default server gets no flags', async () => {
    const exec = fakeExecutor(() => ({ stdout: '' }))
    await new TmuxClient(exec).sendKeys('%1', ['Enter'])
    expect(exec.calls[0]?.rawArgs).toEqual(['-u', 'send-keys', '-t', '%1', 'Enter'])
    expect(tmuxServerArgs(null)).toEqual([])
  })
})

describe('generated tmux config', () => {
  test('minimal: our settings only', () => {
    const conf = renderTmuxConf('minimal', '/Users/u')
    expect(conf).toContain('set -s escape-time 10')
    expect(conf).toContain('set -s focus-events on')
    expect(conf).toContain('set -g history-limit 50000')
    expect(conf).not.toContain('source-file')
  })

  test('user: sources the classic and XDG files after our settings, quoted for tmux', () => {
    const home = "/Users/it's"
    expect(userTmuxConfs(home)).toEqual([`${home}/.tmux.conf`, `${home}/.config/tmux/tmux.conf`])
    const conf = renderTmuxConf('user', home)
    expect(conf).toContain(`source-file -q "${home}/.tmux.conf"`)
    expect(conf).toContain(`source-file -q "${home}/.config/tmux/tmux.conf"`)
    expect(conf.indexOf('escape-time')).toBeLessThan(conf.indexOf('source-file'))
  })

  test('ensureTmuxConf writes when missing or different, and nothing for the default server', async () => {
    const minimal = { tmuxSocket: 'remote-harness', tmuxConfig: 'minimal' as const }
    expect(await ensureTmuxConf(minimal, '/Users/u')).toEqual({ path: paths.tmuxConf(), changed: true })
    expect(await readFile(paths.tmuxConf(), 'utf8')).toBe(renderTmuxConf('minimal', '/Users/u'))
    expect(await ensureTmuxConf(minimal, '/Users/u')).toEqual({ path: paths.tmuxConf(), changed: false })
    expect((await ensureTmuxConf({ ...minimal, tmuxConfig: 'user' }, '/Users/u'))?.changed).toBe(true)
    expect(await readFile(paths.tmuxConf(), 'utf8')).toContain('source-file')
    expect(await ensureTmuxConf({ tmuxSocket: null, tmuxConfig: 'minimal' }, '/Users/u')).toBeNull()
  })
})

describe('legacySessionsExist', () => {
  test('asks the default server for the launchers session, by its current and its old name', async () => {
    const exec = fakeExecutor(({ args }) => ({ exitCode: args.includes('=claude-remote') ? 0 : 1 }))
    expect(await legacySessionsExist(exec, '/opt/bin/tmux', ['remote-harness', 'claude-remote'])).toBe(
      'claude-remote',
    )
    expect(exec.calls.map((c) => [c.file, ...c.rawArgs].join(' '))).toEqual([
      '/opt/bin/tmux has-session -t =remote-harness',
      '/opt/bin/tmux has-session -t =claude-remote',
    ])
    expect(
      await legacySessionsExist(
        fakeExecutor(() => ({ exitCode: 1 })),
        'tmux',
        ['remote-harness'],
      ),
    ).toBeNull()
  })
})

describe('renameLegacySession', () => {
  const server = { socket: 'remote-harness', conf: '/h/.remote-harness/tmux.conf' }

  test('renames the old session to the configured one on the Remote Harness server when only the old one exists', async () => {
    const exec = fakeExecutor(({ args }) =>
      args.includes('has-session') && args.includes('=remote-harness') ? { exitCode: 1 } : { exitCode: 0 },
    )
    expect(await renameLegacySession(exec, 'tmux', server, 'claude-remote', 'remote-harness')).toBe(true)
    expect(exec.calls.map((c) => c.rawArgs.join(' '))).toEqual([
      '-L remote-harness -f /h/.remote-harness/tmux.conf has-session -t =remote-harness',
      '-L remote-harness -f /h/.remote-harness/tmux.conf has-session -t =claude-remote',
      '-L remote-harness -f /h/.remote-harness/tmux.conf rename-session -t =claude-remote remote-harness',
    ])
  })

  test('leaves things alone when the configured session exists or the old one does not', async () => {
    const both = fakeExecutor(() => ({ exitCode: 0 }))
    expect(await renameLegacySession(both, 'tmux', null, 'claude-remote', 'remote-harness')).toBe(false)
    expect(both.calls).toHaveLength(1)
    const neither = fakeExecutor(() => ({ exitCode: 1 }))
    expect(await renameLegacySession(neither, 'tmux', null, 'claude-remote', 'remote-harness')).toBe(false)
    expect(neither.calls).toHaveLength(2)
  })
})
