import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PermissionRequestInfo, Profile, ServerMessage } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { resolveProfiles } from '../src/core/config.ts'
import { messagesFor } from '../src/core/i18n/index.ts'
import { KeyedMutex } from '../src/core/keyed-mutex.ts'
import { silentLogger } from '../src/core/logger.ts'
import { gemini, geminiApprovalDialog } from '../src/features/agents/gemini.ts'
import { agentFor } from '../src/features/agents/index.ts'
import { hasOurHooks, installHooks, settingsPath, uninstallHooks } from '../src/features/hooks/installer.ts'
import { renderLauncher } from '../src/features/hooks/launcher.ts'
import {
  buildGeminiHookEntry,
  GEMINI_HOOK_EVENTS,
  isOurHook,
  mergeOurHooks,
  removeOurHooks,
} from '../src/features/hooks/settings-hooks.ts'
import { InputService } from '../src/features/input/service.ts'
import { PermissionBroker } from '../src/features/permissions/broker.ts'
import { SessionService } from '../src/features/sessions/service.ts'
import { SessionStore } from '../src/features/sessions/store.ts'
import type { SessionRecord } from '../src/features/sessions/types.ts'
import { detectConfigDirs, suggestProfile, validateAlias } from '../src/features/setup/profiles.ts'
import { TmuxClient } from '../src/infra/tmux.ts'
import { fakeExecutor, hookEvent, useTempHome } from './helpers.ts'

const home = useTempHome()
const options = { port: 7338, secret: 's3cr3t', permissionTimeoutSec: 300 }
const userHook = { hooks: [{ type: 'command', command: 'say done' }] }
const fixture = join(import.meta.dirname, 'fixtures', 'gemini-session.jsonl')

describe('gemini settings.json hooks', () => {
  test("Gemini's events post ours, next to user hooks and settings, idempotent and removable", () => {
    const settings = { ui: { theme: 'Dracula' }, hooks: { AfterAgent: [userHook] } }
    const once = mergeOurHooks(settings, options, 'gemini-hooks')
    expect(mergeOurHooks(once, options, 'gemini-hooks')).toEqual(once)
    expect(Object.keys(once.hooks).sort()).toEqual(Object.keys(GEMINI_HOOK_EVENTS).sort())
    expect(once.ui).toEqual({ theme: 'Dracula' })
    expect(once.hooks.AfterAgent?.[0]).toEqual(userHook)
    for (const [key, event] of Object.entries(GEMINI_HOOK_EVENTS)) {
      const entry = once.hooks[key]?.at(-1)?.hooks[0]
      expect(entry && isOurHook(entry)).toBe(true)
      expect(entry?.command).toContain(`/hooks/${event}'`)
    }
    expect(removeOurHooks(once)).toEqual(settings)
  })

  test('the prompt hook posts UserPromptSubmit, the dialog notice PermissionDialog', () => {
    expect(GEMINI_HOOK_EVENTS.BeforeAgent).toBe('UserPromptSubmit')
    expect(GEMINI_HOOK_EVENTS.AfterAgent).toBe('Stop')
    expect(GEMINI_HOOK_EVENTS.Notification).toBe('PermissionDialog')
  })

  test('timeouts are in milliseconds and outputs are discarded', () => {
    const dialog = buildGeminiHookEntry('PermissionDialog', options)
    expect(dialog.timeout).toBe(10_000)
    expect(dialog.command).toContain('-o /dev/null')
    const end = buildGeminiHookEntry('SessionEnd', options)
    expect(end.timeout).toBe(3_000)
    expect(end.command).toContain('-m 2 ')
  })

  test('install writes the profile settings.json with a backup; doctor sees it', async () => {
    const configDir = join(home.dir(), '.gemini')
    await mkdir(configDir, { recursive: true })
    const profile: Profile = { id: 'gem', name: 'Gemini', configDir, color: '', agent: 'gemini' }
    const path = join(configDir, 'settings.json')
    expect(settingsPath(profile)).toBe(path)
    await writeFile(path, JSON.stringify({ hooks: { AfterAgent: [userHook] } }))
    expect(await hasOurHooks(profile)).toBe(false)
    expect(await installHooks(profile, options)).toBe(true)
    expect(await installHooks(profile, options)).toBe(false)
    expect(await hasOurHooks(profile)).toBe(true)
    expect(await readFile(`${path}.bak-claude-remote`, 'utf8')).toContain('say done')
    await uninstallHooks(profile)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ hooks: { AfterAgent: [userHook] } })
  })
})

describe('gemini launcher', () => {
  const tmux = { tmuxSession: 's', tmuxBin: 'tmux', home: '/Users/u' }

  test('GEMINI_CLI_HOME is the parent of the .gemini folder; gemini runs, never a provider block', () => {
    const script = renderLauncher(
      {
        id: 'gem-work',
        name: 'Gemini Work',
        configDir: '/Users/u/work/.gemini',
        color: '',
        agent: 'gemini',
        provider: { kind: 'openrouter' },
      },
      tmux,
    )
    execFileSync('zsh', ['-n', '-c', script])
    expect(script).toContain("export GEMINI_CLI_HOME='/Users/u/work'")
    expect(script).toMatch(/^GEMINI_BIN=\$\{CLAUDE_REMOTE_GEMINI_BIN:-gemini\}$/m)
    expect(script).toContain('-e "GEMINI_CLI_HOME=$GEMINI_CLI_HOME"')
    expect(script).not.toContain('CLAUDE_CONFIG_DIR')
    expect(script).not.toContain('read_provider_key')
  })

  test('the default ~/.gemini runs with GEMINI_CLI_HOME unset', () => {
    const script = renderLauncher(
      { id: 'gem', name: 'G', configDir: '/Users/u/.gemini', color: '', agent: 'gemini' },
      tmux,
    )
    expect(script).toContain('unset GEMINI_CLI_HOME')
    expect(script).toContain('cmd=(env -u GEMINI_CLI_HOME "$GEMINI_BIN" "$@")')
  })

  test('resume and no worktree, name or one-shot', () => {
    expect(gemini.resumeArgs('3f2a')).toEqual(['--resume', '3f2a'])
    expect(gemini.worktreeArgs('x')).toBeNull()
    expect(gemini.nameArgs('x')).toBeNull()
    expect(gemini.polish).toBeNull()
    expect(gemini.permissionRules).toBe(false)
  })
})

describe('gemini profiles and setup', () => {
  test('a Gemini profile must point at a .gemini folder', async () => {
    const good = join(home.dir(), '.gemini')
    const bad = join(home.dir(), 'gemini-work')
    await mkdir(good, { recursive: true })
    await mkdir(bad, { recursive: true })
    const profiles = await resolveProfiles(
      {
        profiles: [
          { id: 'gem', name: 'G', configDir: good, color: '', agent: 'gemini' },
          { id: 'bad', name: 'B', configDir: bad, color: '', agent: 'gemini' },
        ],
      } as Parameters<typeof resolveProfiles>[0],
      silentLogger,
    )
    expect(profiles.map((p) => p.id)).toEqual(['gem'])
    expect(agentFor(profiles[0] as Profile).id).toBe('gemini')
  })

  test('detects ~/.gemini once Gemini CLI used it and suggests a Gemini profile', async () => {
    const dir = home.dir()
    await mkdir(join(dir, '.claude'), { recursive: true })
    await mkdir(join(dir, '.gemini'), { recursive: true })
    expect(await detectConfigDirs(dir)).toEqual(['~/.claude'])
    await writeFile(join(dir, '.gemini', 'oauth_creds.json'), '{}')
    expect(await detectConfigDirs(dir)).toEqual(['~/.claude', '~/.gemini'])
    const m = messagesFor('en-US').profiles
    expect(suggestProfile('~/.gemini', [], 1, m)).toEqual({
      id: 'gem',
      name: 'Gemini',
      configDir: '~/.gemini',
      color: '#E3729E',
      agent: 'gemini',
    })
    expect(suggestProfile('~/work/.gemini', [], 2, m)).toMatchObject({
      id: 'gem-work',
      name: 'Gemini Work',
      agent: 'gemini',
    })
    expect(validateAlias('gemini', [], m)).not.toBe(true)
  })
})

describe('gemini session files', () => {
  async function writeSession(configDir: string): Promise<string> {
    const project = join(configDir, 'tmp', 'api')
    await mkdir(join(project, 'chats', '3f2a9c1e-parent'), { recursive: true })
    await writeFile(join(project, '.project_root'), '/Users/a/api\n')
    const path = join(project, 'chats', 'session-2026-10-31T09-12-3f2a9c1e.jsonl')
    await writeFile(path, await readFile(fixture, 'utf8'))
    // A subagent's file, one level deeper: not a session of its own.
    await writeFile(join(project, 'chats', '3f2a9c1e-parent', 'agent.jsonl'), '{"sessionId":"sub"}\n')
    return path
  }

  test('found with the id from the header; folder and title from the project and first prompt', async () => {
    const configDir = join(home.dir(), '.gemini')
    const path = await writeSession(configDir)
    const found = await gemini.findTranscripts(configDir, 0)
    expect(found.map((f) => [f.sessionId, f.path])).toEqual([['3f2a9c1e-5b7d-4e2f-9a10-6c8d2e4f1a3b', path]])
    expect(await gemini.readSummary(path, configDir)).toEqual({
      title: 'run the tests',
      cwd: '/Users/a/api',
      permissionMode: null,
      approvalPolicy: null,
    })
  })

  test('hooks drive the session: start, prompt, dialog, turn end', async () => {
    const configDir = join(home.dir(), '.gemini')
    const path = await writeSession(configDir)
    const store = new SessionStore({ broadcast: () => {} }, join(home.dir(), 's.json'), silentLogger, 60_000)
    const profiles: Profile[] = [{ id: 'gem', name: 'Gemini', configDir, color: '', agent: 'gemini' }]
    const service = new SessionService(store, new TmuxClient(fakeExecutor()), profiles, silentLogger, {
      recentDays: 7,
      scanCacheMs: 0,
    })
    const id = '3f2a9c1e-5b7d-4e2f-9a10-6c8d2e4f1a3b'
    const on = (event: Parameters<typeof hookEvent>[0], payload: Record<string, unknown> = {}) =>
      service.handleHook(hookEvent(event, { session_id: id, ...payload }, { paneId: '%7', profileId: 'gem' }))
    try {
      // Gemini fires SessionStart before the first record: no transcript path yet.
      await on('SessionStart', { cwd: '/Users/a/api', transcript_path: '' })
      expect(store.get(id)).toMatchObject({
        agent: 'gemini',
        controllable: true,
        paneId: '%7',
        state: 'idle',
      })
      await on('UserPromptSubmit', { prompt: 'run the tests', transcript_path: path })
      expect(store.get(id)).toMatchObject({ state: 'running', title: 'run the tests', transcriptPath: path })
      await on('PermissionDialog', { notification_type: 'ToolPermission' })
      expect(store.get(id)?.state).toBe('waiting')
      await on('Stop')
      expect(store.get(id)?.state).toBe('idle')
    } finally {
      store.dispose()
    }
  })
})

describe('gemini approvals through the pane', () => {
  const screen = (open: boolean) =>
    open
      ? '? Shell pnpm test\n● 1. Allow once\n  2. Allow for this session\n  3. No, suggest changes (esc)\n'
      : '> Type your message\n'

  function setup(dialogOpen = true) {
    const sent: ServerMessage[] = []
    const typed: string[][] = []
    const broker = new PermissionBroker(
      { broadcast: (m) => sent.push(m) },
      {
        timeoutMs: 5_000,
        defaultScope: 'project',
        profiles: [{ id: 'gem', name: 'G', configDir: '/cfg/.gemini', color: '', agent: 'gemini' }],
        denyMessage: 'Denied from the phone',
        keepPlanningMessage: 'keep planning',
        answerDialog: async (_info, behavior) => {
          if (!geminiApprovalDialog.isOpen(screen(dialogOpen))) return false
          typed.push(behavior === 'allow' ? geminiApprovalDialog.allowKeys : geminiApprovalDialog.denyKeys)
          return true
        },
      },
    )
    const hook = hookEvent(
      'PermissionDialog',
      {
        session_id: 's1',
        cwd: '/w',
        notification_type: 'ToolPermission',
        details: { type: 'exec', title: 'Shell', command: 'pnpm test', rootCommand: 'pnpm' },
      },
      { profileId: 'gem', paneId: '%7' },
    )
    const request = () =>
      sent.flatMap((m) => (m.type === 'permission.request' ? [m.request] : []))[0] as PermissionRequestInfo
    const outcome = () => sent.flatMap((m) => (m.type === 'permission.resolved' ? [m.outcome] : []))
    return { broker, hook, request, typed, outcome }
  }

  test('the request opens at once, Allow / Deny only, from the dialog details', () => {
    const { broker, hook, request } = setup()
    broker.openDialog(hook, geminiApprovalDialog)
    expect(request()).toMatchObject({
      tool: 'exec',
      input: { command: 'pnpm test' },
      suggestedRule: null,
      rules: false,
    })
    expect(broker.hasPending('s1')).toBe(true)
  })

  test('Allow presses 1 in the dialog', async () => {
    const { broker, hook, request, typed, outcome } = setup()
    broker.openDialog(hook, geminiApprovalDialog)
    await broker.respond(request().requestId, { behavior: 'allow' })
    await Promise.resolve()
    expect(typed).toEqual([['1']])
    expect(outcome()).toEqual(['allowed'])
    expect(broker.hasPending('s1')).toBe(false)
  })

  test('Deny presses Escape', async () => {
    const { broker, hook, request, typed, outcome } = setup()
    broker.openDialog(hook, geminiApprovalDialog)
    await broker.respond(request().requestId, { behavior: 'deny' })
    await Promise.resolve()
    expect(typed).toEqual([['Escape']])
    expect(outcome()).toEqual(['denied'])
  })

  test('no dialog on screen: nothing typed, already resolved', async () => {
    const { broker, hook, request, typed, outcome } = setup(false)
    broker.openDialog(hook, geminiApprovalDialog)
    await expect(broker.respond(request().requestId, { behavior: 'allow' })).rejects.toThrow(
      /no longer on screen/,
    )
    await Promise.resolve()
    expect(typed).toEqual([])
    expect(outcome()).toEqual(['cancelled'])
  })

  test('Always is refused', () => {
    const { broker, hook, request } = setup()
    broker.openDialog(hook, geminiApprovalDialog)
    expect(() =>
      broker.respond(request().requestId, {
        behavior: 'allow',
        always: { rule: 'Bash(pnpm:*)', scope: 'project' },
      }),
    ).toThrow(/does not take permission rules/)
  })

  test('dialog details become the tools the app renders', () => {
    expect(
      geminiApprovalDialog.request({
        details: { type: 'edit', filePath: '/w/a.ts', originalContent: 'a', newContent: 'b' },
      }),
    ).toEqual({ tool: 'Edit', input: { file_path: '/w/a.ts', old_string: 'a', new_string: 'b' } })
    expect(
      geminiApprovalDialog.request({ details: { type: 'mcp', serverName: 'gh', toolName: 'pr' } }),
    ).toEqual({
      tool: 'mcp__gh__pr',
      input: {},
    })
  })

  test('the dialog only counts as open with its Allow once option', () => {
    expect(geminiApprovalDialog.isOpen(screen(true))).toBe(true)
    expect(geminiApprovalDialog.isOpen(screen(false))).toBe(false)
    expect(geminiApprovalDialog.isOpen('1. Modify with external editor\n2. No, suggest changes (esc)')).toBe(
      false,
    )
  })
})

describe('gemini input', () => {
  function session(): SessionRecord {
    return {
      id: 'g',
      profileId: 'gem',
      agent: 'gemini',
      cwd: '/w',
      title: 't',
      state: 'idle',
      permissionMode: null,
      approvalPolicy: null,
      permissionProfile: null,
      controllable: true,
      paneId: '%7',
      updatedAt: '',
      subagents: [],
      backgroundTasks: 0,
      lastActivity: null,
      checkout: null,
      status: null,
      transcriptPath: null,
    }
  }

  test('Enter waits 250 ms after the paste; typing uses C-j for new lines', async () => {
    const store = new SessionStore({ broadcast: () => {} }, join(home.dir(), 's.json'), silentLogger, 60_000)
    store.upsert('g', {}, session)
    store.dispose()
    const sleeps: number[] = []
    const paste = fakeExecutor()
    await new InputService(new TmuxClient(paste), store, new KeyedMutex(), {
      strategy: 'paste',
      pasteEnterDelayMs: 80,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
    }).sendText('g', 'continue')
    expect(sleeps).toEqual([250])
    const type = fakeExecutor()
    await new InputService(new TmuxClient(type), store, new KeyedMutex(), {
      strategy: 'type',
      pasteEnterDelayMs: 80,
      sleep: async () => {},
    }).sendText('g', 'a\nb')
    expect(type.calls.map((c) => c.args.slice(3))).toEqual([
      ['-l', '--', 'a'],
      ['C-j'],
      ['-l', '--', 'b'],
      ['Enter'],
    ])
  })
})
