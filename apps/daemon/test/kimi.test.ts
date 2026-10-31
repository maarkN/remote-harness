import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PermissionRequestInfo, Profile, ServerMessage } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { messagesFor } from '../src/core/i18n/index.ts'
import { kimi, kimiApprovalDialog, workDirHash } from '../src/features/agents/kimi.ts'
import { hasOurHooks, installHooks, settingsPath, uninstallHooks } from '../src/features/hooks/installer.ts'
import {
  hasInlineHooks,
  installedKimiEvents,
  KIMI_HOOK_EVENTS,
  mergeKimiHooks,
  removeKimiHooks,
  tomlString,
} from '../src/features/hooks/kimi-hooks.ts'
import { renderLauncher } from '../src/features/hooks/launcher.ts'
import { withTranscriptPath } from '../src/features/hooks/receiver.ts'
import { PermissionBroker } from '../src/features/permissions/broker.ts'
import { ScreenDialogWatcher, type WatchedSession } from '../src/features/permissions/screen-dialogs.ts'
import { detectConfigDirs, suggestProfile, validateAlias } from '../src/features/setup/profiles.ts'
import { findKimiImage, kimiTool, parseKimiLine } from '../src/features/transcript/kimi-format.ts'
import { hookEvent, useTempHome } from './helpers.ts'

const home = useTempHome()
const options = { port: 7338, secret: 's3cr3t', permissionTimeoutSec: 300 }
const fixture = join(import.meta.dirname, 'fixtures', 'kimi-wire.jsonl')

async function fixtureLines(): Promise<string[]> {
  return (await readFile(fixture, 'utf8')).split('\n').filter(Boolean)
}

describe('kimi wire parser', () => {
  test('prompts, thinking, replies, tool calls and results, interruptions', async () => {
    const all = (await fixtureLines()).flatMap((line, i) => parseKimiLine(line, i))
    expect(all.map((e) => e.kind)).toEqual([
      'user',
      'thinking',
      'assistant_text',
      'tool_use',
      'tool_result',
      'tool_use',
      'tool_result',
      'assistant_text',
      'user',
      'system',
      'system',
    ])
    expect(all[3]).toMatchObject({ name: 'exec', input: { command: 'pnpm test' }, toolUseId: 'tool_1' })
    expect(all[4]).toMatchObject({ content: 'ok', isError: false, toolUseId: 'tool_1' })
    expect(all[5]).toMatchObject({
      name: 'Edit',
      input: { file_path: '/w/api/src/a.ts', old_string: 'a', new_string: 'b' },
    })
    expect(all[6]).toMatchObject({ content: 'The old string was not found.', isError: true })
    expect(all[9]).toMatchObject({ subtype: 'turn_aborted', text: 'Interrupted' })
    expect(all[10]).toMatchObject({ subtype: 'compact_boundary' })
    expect(all[0]).toMatchObject({ timestamp: new Date(1761901925_000).toISOString(), key: 'line-1:0' })
  })

  test('prompt images', async () => {
    const line = (await fixtureLines())[12] ?? ''
    expect(parseKimiLine(line, 12)).toMatchObject([
      { kind: 'user', text: 'look', images: [{ id: '12.0', mediaType: 'image/png', bytes: 5 }] },
    ])
    expect(findKimiImage(line, 0)).toMatchObject({ mediaType: 'image/png', data: 'aGVsbG8=' })
  })

  test('metadata, unknown and broken lines yield nothing', () => {
    for (const raw of [
      '{"type":"metadata","protocol_version":"1.10"}',
      '{"message":{"type":"Nope"}}',
      'x',
      '[]',
    ])
      expect(parseKimiLine(raw, 0)).toEqual([])
  })

  test('tool names the app renders', () => {
    expect(kimiTool('ReadFile', { path: '/a' })).toEqual({ name: 'Read', input: { file_path: '/a' } })
    expect(kimiTool('Glob', { pattern: '*.ts', directory: 'src' })).toEqual({
      name: 'Glob',
      input: { pattern: '*.ts', path: 'src' },
    })
    expect(kimiTool('FetchURL', { url: 'https://x' })).toEqual({
      name: 'WebFetch',
      input: { url: 'https://x' },
    })
    expect(kimiTool('SetTodoList', { todos: [] })).toEqual({ name: 'SetTodoList', input: { todos: [] } })
  })
})

describe('kimi config.toml hooks', () => {
  const user = `default_model = "kimi-k2"

[models.kimi]
provider = "moonshot"

[[hooks]]
event = "Stop"
command = "say done"
`

  test('one table per Kimi event, every other line kept, idempotent and removable', () => {
    const once = mergeKimiHooks(user, options) ?? ''
    expect(once.startsWith(user)).toBe(true)
    expect(mergeKimiHooks(once, options)).toBe(once)
    expect([...installedKimiEvents(once)].sort()).toEqual(Object.keys(KIMI_HOOK_EVENTS).sort())
    expect(once).toContain("/hooks/Stop'")
    expect(removeKimiHooks(once)).toBe(user)
    expect(installedKimiEvents(user).size).toBe(0)
  })

  test('the command survives TOML escaping', () => {
    const once = mergeKimiHooks('', options) ?? ''
    const line = once.split('\n').find((l) => l.startsWith('command = ')) ?? ''
    expect(tomlString(line.slice('command = '.length))).toContain(`x-claude-remote-pane: $TMUX_PANE`)
  })

  test('found again after Kimi rewrote the file (comments gone, literal strings)', () => {
    const command =
      (mergeKimiHooks('', options) ?? '').split('\n').find((l) => l.startsWith('command = ')) ?? ''
    const value = tomlString(command.slice('command = '.length)) ?? ''
    const rewritten = `default_model = "kimi-k2"\n\n[[hooks]]\nevent = "SessionStart"\ncommand = ${JSON.stringify(value)}\nmatcher = ""\ntimeout = 10\n`
    expect(installedKimiEvents(rewritten)).toEqual(new Set(['SessionStart']))
    expect(removeKimiHooks(rewritten)).toBe('default_model = "kimi-k2"\n')
  })

  test('an inline hooks key is never touched', () => {
    const inline = 'hooks = [{ event = "Stop", command = "say done" }]\n'
    expect(hasInlineHooks(inline)).toBe(true)
    expect(mergeKimiHooks(inline, options)).toBeNull()
  })

  test('install writes config.toml with a backup; doctor sees it; uninstall restores it', async () => {
    const configDir = join(home.dir(), '.kimi')
    await mkdir(configDir, { recursive: true })
    const profile: Profile = { id: 'km', name: 'Kimi', configDir, color: '', agent: 'kimi' }
    const path = join(configDir, 'config.toml')
    expect(settingsPath(profile)).toBe(path)
    await writeFile(path, user)
    expect(await hasOurHooks(profile)).toBe(false)
    expect(await installHooks(profile, options)).toBe(true)
    expect(await installHooks(profile, options)).toBe(false)
    expect(await hasOurHooks(profile)).toBe(true)
    expect(await readFile(`${path}.bak-claude-remote`, 'utf8')).toBe(user)
    await uninstallHooks(profile)
    expect(await readFile(path, 'utf8')).toBe(user)
  })
})

describe('kimi adapter', () => {
  test('launcher exports KIMI_SHARE_DIR and runs kimi; resume with --session', () => {
    const script = renderLauncher(
      { id: 'km-work', name: 'K', configDir: '/Users/u/.kimi-work', color: '', agent: 'kimi' },
      { tmuxSession: 's', tmuxBin: 'tmux', home: '/Users/u' },
    )
    execFileSync('zsh', ['-n', '-c', script])
    expect(script).toContain("export KIMI_SHARE_DIR='/Users/u/.kimi-work'")
    expect(script).toMatch(/^KIMI_BIN=\$\{CLAUDE_REMOTE_KIMI_BIN:-kimi\}$/m)
    const own = renderLauncher(
      { id: 'km', name: 'K', configDir: '/Users/u/.kimi', color: '', agent: 'kimi' },
      { tmuxSession: 's', tmuxBin: 'tmux', home: '/Users/u' },
    )
    expect(own).toContain('unset KIMI_SHARE_DIR')
    expect(kimi.resumeArgs('5d1c')).toEqual(['--session', '5d1c'])
    expect(kimi.worktreeArgs('x')).toBeNull()
    expect(kimi.polish).toBeNull()
  })

  async function writeSession(configDir: string, cwd: string, id: string, state?: object): Promise<string> {
    const dir = join(configDir, 'sessions', workDirHash(cwd), id)
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(configDir, 'kimi.json'),
      JSON.stringify({ work_dirs: [{ path: cwd, kaos: 'local' }] }),
    )
    const path = join(dir, 'wire.jsonl')
    await writeFile(path, await readFile(fixture, 'utf8'))
    if (state) await writeFile(join(dir, 'state.json'), JSON.stringify(state))
    return path
  }

  test('sessions found by folder; title and work dir from state.json and kimi.json', async () => {
    const configDir = join(home.dir(), '.kimi')
    const id = '5d1c2b3a-0000-4000-8000-000000000001'
    const path = await writeSession(configDir, '/Users/a/api', id)
    expect((await kimi.findTranscripts(configDir, 0)).map((f) => [f.sessionId, f.path])).toEqual([[id, path]])
    expect(await kimi.readSummary(path, configDir)).toMatchObject({
      title: 'run the tests',
      cwd: '/Users/a/api',
    })
    await writeFile(join(path, '..', 'state.json'), JSON.stringify({ custom_title: 'Login bug' }))
    expect(await kimi.readSummary(path, configDir)).toMatchObject({ title: 'Login bug' })
  })

  test('hooks get the transcript path Kimi does not send', () => {
    const profile: Profile = { id: 'km', name: 'K', configDir: '/Users/a/.kimi', color: '', agent: 'kimi' }
    const payload = withTranscriptPath({ session_id: '5d1c', cwd: '/Users/a/api' }, profile)
    expect(payload.transcript_path).toBe(
      `/Users/a/.kimi/sessions/${workDirHash('/Users/a/api')}/5d1c/wire.jsonl`,
    )
    const claude: Profile = { id: 'c', name: 'C', configDir: '/Users/a/.claude', color: '' }
    expect(withTranscriptPath({ session_id: 's', cwd: '/w' }, claude).transcript_path).toBeUndefined()
  })

  test('setup detects ~/.kimi and suggests a Kimi profile', async () => {
    const dir = home.dir()
    await mkdir(join(dir, '.claude'), { recursive: true })
    await mkdir(join(dir, '.kimi'), { recursive: true })
    expect(await detectConfigDirs(dir)).toEqual(['~/.claude'])
    await writeFile(join(dir, '.kimi', 'config.toml'), '')
    expect(await detectConfigDirs(dir)).toEqual(['~/.claude', '~/.kimi'])
    const m = messagesFor('en-US').profiles
    expect(suggestProfile('~/.kimi', [], 1, m)).toEqual({
      id: 'km',
      name: 'Kimi',
      configDir: '~/.kimi',
      color: '#5B9BF5',
      agent: 'kimi',
    })
    expect(validateAlias('kimi', [], m)).not.toBe(true)
  })
})

const PANEL = (command: string) => `
╭─ approval ───────────────────────────────────────╮
│ Shell is requesting approval to run command:     │
│                                                  │
│ ${command.padEnd(48)} │
│                                                  │
│ → [1] Approve once                               │
│   [2] Approve for this session                   │
│   [3] Reject                                     │
│   [4] Reject, tell the model what to do instead  │
│                                                  │
│   ▲/▼ select  1/2/3/4 choose  ↵ confirm           │
╰──────────────────────────────────────────────────╯
`

describe('kimi approval panel', () => {
  test('detected on screen and told apart by its preview', () => {
    expect(kimiApprovalDialog.isOpen(PANEL('pnpm test'))).toBe(true)
    expect(kimiApprovalDialog.isOpen('> type here\n')).toBe(false)
    expect(kimiApprovalDialog.identify(PANEL('pnpm test'))).not.toBe(
      kimiApprovalDialog.identify(PANEL('rm -rf b')),
    )
    expect(kimiApprovalDialog.identify(PANEL('pnpm test'))).toBe(
      kimiApprovalDialog.identify(PANEL('pnpm test')),
    )
    expect(kimiApprovalDialog.allowKeys).toEqual(['1'])
    expect(kimiApprovalDialog.denyKeys).toEqual(['3'])
  })

  test('the request names the pending tool call, else the panel', () => {
    expect(kimiApprovalDialog.request({ tool_name: 'exec', tool_input: { command: 'pnpm test' } })).toEqual({
      tool: 'exec',
      input: { command: 'pnpm test' },
    })
    expect(kimiApprovalDialog.request({ screen: PANEL('pnpm test') })).toEqual({
      tool: 'Shell',
      input: { description: 'run command' },
    })
  })
})

describe('screen dialog watcher', () => {
  function setup() {
    const sent: ServerMessage[] = []
    const typed: string[][] = []
    let screen = '> idle\n'
    const session: WatchedSession = {
      id: 's1',
      profileId: 'km',
      paneId: '%3',
      state: 'running',
      controllable: true,
    }
    const broker = new PermissionBroker(
      { broadcast: (m) => sent.push(m) },
      {
        timeoutMs: 5_000,
        defaultScope: 'project',
        profiles: [{ id: 'km', name: 'K', configDir: '/k', color: '', agent: 'kimi' }],
        denyMessage: 'Denied',
        keepPlanningMessage: 'keep planning',
        answerDialog: async (info, behavior) => {
          if (!kimiApprovalDialog.isOpen(screen)) return false
          if (kimiApprovalDialog.identify(screen) !== watcher.identityOf(info.requestId)) return false
          typed.push(behavior === 'allow' ? kimiApprovalDialog.allowKeys : kimiApprovalDialog.denyKeys)
          return true
        },
      },
    )
    const watcher = new ScreenDialogWatcher({
      sessions: () => [session],
      dialogOf: () => kimiApprovalDialog,
      capture: async () => screen,
      open: async (s, dialog, shown) =>
        broker.openDialog(
          hookEvent(
            'PermissionDialog',
            { session_id: s.id, screen: shown },
            { profileId: 'km', paneId: '%3' },
          ),
          dialog,
        ),
      isPending: (id) => broker.list().some((i) => i.requestId === id && !i.terminal),
      gone: (id) => broker.dialogGone(id),
    })
    const requests = () =>
      sent.flatMap((m) => (m.type === 'permission.request' ? [m.request] : [])) as PermissionRequestInfo[]
    const outcomes = () => sent.flatMap((m) => (m.type === 'permission.resolved' ? [m.outcome] : []))
    const show = (value: string) => {
      screen = value
    }
    return { broker, watcher, requests, outcomes, typed, show }
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  test('a panel opens one request; Allow presses 1; the lingering panel opens nothing new', async () => {
    const { broker, watcher, requests, outcomes, typed, show } = setup()
    await watcher.tick()
    expect(requests()).toHaveLength(0)
    show(PANEL('pnpm test'))
    await watcher.tick()
    await watcher.tick()
    expect(requests()).toHaveLength(1)
    expect(requests()[0]).toMatchObject({ tool: 'Shell', rules: false })
    await broker.respond(requests()[0]?.requestId ?? '', { behavior: 'allow' })
    await settle()
    expect(typed).toEqual([['1']])
    expect(outcomes()).toEqual(['allowed'])
    await watcher.tick()
    expect(requests()).toHaveLength(1)
  })

  test('answered in the terminal: the panel goes away and the request resolves', async () => {
    const { watcher, requests, outcomes, show } = setup()
    show(PANEL('pnpm test'))
    await watcher.tick()
    show('> idle\n')
    await watcher.tick()
    await settle()
    expect(requests()).toHaveLength(1)
    expect(outcomes()).toEqual(['cancelled'])
  })

  test('a different panel replaces the request; an answer meant for the old one types nothing', async () => {
    const { broker, watcher, requests, outcomes, typed, show } = setup()
    show(PANEL('pnpm test'))
    await watcher.tick()
    const first = requests()[0]?.requestId ?? ''
    show(PANEL('rm -rf build'))
    await expect(broker.respond(first, { behavior: 'allow' })).rejects.toThrow(/no longer on screen/)
    await watcher.tick()
    await settle()
    expect(typed).toEqual([])
    expect(requests()).toHaveLength(2)
    expect(outcomes()).toEqual(['cancelled'])
    await broker.respond(requests()[1]?.requestId ?? '', { behavior: 'deny' })
    await settle()
    expect(typed).toEqual([['3']])
  })

  test('idle sessions are not watched', async () => {
    const { watcher, requests, show } = setup()
    show(PANEL('pnpm test'))
    const idle = new ScreenDialogWatcher({
      sessions: () => [{ id: 's1', profileId: 'km', paneId: '%3', state: 'idle', controllable: true }],
      dialogOf: () => kimiApprovalDialog,
      capture: async () => PANEL('pnpm test'),
      open: async () => 'x',
      isPending: () => false,
      gone: () => {},
    })
    await idle.tick()
    expect(requests()).toHaveLength(0)
    expect(watcher.identityOf('x')).toBeUndefined()
  })
})
