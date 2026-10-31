import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PermissionRequestInfo, Profile, ServerMessage } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { messagesFor } from '../src/core/i18n/index.ts'
import { qwen } from '../src/features/agents/qwen.ts'
import { hasOurHooks, installHooks, settingsPath, uninstallHooks } from '../src/features/hooks/installer.ts'
import { renderLauncher } from '../src/features/hooks/launcher.ts'
import {
  isOurHook,
  mergeOurHooks,
  QWEN_HOOK_EVENTS,
  removeOurHooks,
} from '../src/features/hooks/settings-hooks.ts'
import { PermissionBroker } from '../src/features/permissions/broker.ts'
import { detectConfigDirs, suggestProfile, validateAlias } from '../src/features/setup/profiles.ts'
import {
  parseQwenLine,
  parseQwenMeta,
  qwenSessionId,
  qwenTool,
} from '../src/features/transcript/qwen-format.ts'
import { hookEvent, useTempHome } from './helpers.ts'

const home = useTempHome()
const options = { port: 7338, secret: 's3cr3t', permissionTimeoutSec: 300 }
const fixture = join(import.meta.dirname, 'fixtures', 'qwen-session.jsonl')
const id = '8b0e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4'

async function fixtureLines(): Promise<string[]> {
  return (await readFile(fixture, 'utf8')).split('\n').filter(Boolean)
}

describe('qwen transcript parser', () => {
  test('typed prompts, thoughts, replies, tool calls and results, compaction', async () => {
    const all = (await fixtureLines()).flatMap((line, i) => parseQwenLine(line, i))
    expect(all.map((e) => e.kind)).toEqual([
      'user',
      'thinking',
      'assistant_text',
      'tool_use',
      'tool_result',
      'tool_use',
      'tool_result',
      'assistant_text',
      'system',
    ])
    expect(all[0]).toMatchObject({ text: 'run the tests', key: 'u1:0' })
    expect(all[3]).toMatchObject({ name: 'exec', input: { command: 'pnpm test' }, toolUseId: 'call_1' })
    expect(all[4]).toMatchObject({ content: 'ok', isError: false })
    expect(all[5]).toMatchObject({
      name: 'Edit',
      input: { file_path: '/Users/a/api/src/a.ts', old_string: 'a', new_string: 'b' },
    })
    expect(all[6]).toMatchObject({ content: 'old_string not found', isError: true })
    expect(all[8]).toMatchObject({ subtype: 'compact_boundary' })
    expect(new Set(all.map((e) => e.key)).size).toBe(all.length)
  })

  test('a custom_title record renames the session', async () => {
    const lines = await fixtureLines()
    expect(parseQwenMeta(lines[8] ?? '')).toEqual({ customTitle: 'Run the tests' })
    expect(parseQwenMeta(lines[1] ?? '')).toBeNull()
  })

  test('tool names shared with Gemini CLI', () => {
    expect(qwenTool('web_search', { query: 'tmux' })).toEqual({ name: 'WebSearch', input: { query: 'tmux' } })
    expect(qwenTool('read_file', { absolute_path: '/a' })).toEqual({
      name: 'Read',
      input: { file_path: '/a' },
    })
    expect(qwenTool('todo_write', { todos: [] })).toEqual({ name: 'todo_write', input: { todos: [] } })
  })

  test('garbage yields nothing; file names', () => {
    for (const raw of ['x', '[]', '{"type":"system","subtype":"ui_telemetry"}'])
      expect(parseQwenLine(raw, 0)).toEqual([])
    expect(qwenSessionId(`${id}.jsonl`)).toBe(id)
    expect(qwenSessionId(`${id}.runtime.json`)).toBeNull()
    expect(qwenSessionId('history.ledger.jsonl')).toBeNull()
  })
})

describe('qwen adapter', () => {
  test('transcripts found by file name; title from custom_title, folder from the records', async () => {
    const configDir = join(home.dir(), '.qwen')
    const chats = join(configDir, 'projects', '-Users-a-api', 'chats')
    await mkdir(chats, { recursive: true })
    const path = join(chats, `${id}.jsonl`)
    await writeFile(path, await readFile(fixture, 'utf8'))
    await writeFile(join(chats, `${id}.runtime.json`), '{}')
    expect((await qwen.findTranscripts(configDir, 0)).map((f) => [f.sessionId, f.path])).toEqual([[id, path]])
    expect(await qwen.readSummary(path, configDir)).toEqual({
      title: 'Run the tests',
      cwd: '/Users/a/api',
      permissionMode: null,
      approvalPolicy: null,
    })
  })

  test('launcher exports QWEN_HOME and runs qwen; resume, no worktree or one-shot', () => {
    const script = renderLauncher(
      { id: 'qw-work', name: 'Q', configDir: '/Users/u/.qwen-work', color: '', agent: 'qwen' },
      { tmuxSession: 's', tmuxBin: 'tmux', home: '/Users/u' },
    )
    execFileSync('zsh', ['-n', '-c', script])
    expect(script).toContain("export QWEN_HOME='/Users/u/.qwen-work'")
    expect(script).toMatch(/^QWEN_BIN=\$\{CLAUDE_REMOTE_QWEN_BIN:-qwen\}$/m)
    expect(qwen.resumeArgs('8b0e')).toEqual(['--resume', '8b0e'])
    expect(qwen.worktreeArgs('x')).toBeNull()
    expect(qwen.polish).toBeNull()
    expect(qwen.input.minEnterDelayMs).toBe(250)
  })

  test('setup detects ~/.qwen and suggests a Qwen profile', async () => {
    const dir = home.dir()
    await mkdir(join(dir, '.claude'), { recursive: true })
    await mkdir(join(dir, '.qwen'), { recursive: true })
    expect(await detectConfigDirs(dir)).toEqual(['~/.claude'])
    await writeFile(join(dir, '.qwen', 'settings.json'), '{}')
    expect(await detectConfigDirs(dir)).toEqual(['~/.claude', '~/.qwen'])
    const m = messagesFor('en-US').profiles
    expect(suggestProfile('~/.qwen', [], 1, m)).toEqual({
      id: 'qw',
      name: 'Qwen Code',
      configDir: '~/.qwen',
      color: '#8C6CF5',
      agent: 'qwen',
    })
    expect(validateAlias('qwen', [], m)).not.toBe(true)
  })
})

describe('qwen settings.json hooks', () => {
  const userHook = { hooks: [{ type: 'command', command: 'say done' }] }

  test("command hooks for Qwen's events, next to user hooks, idempotent and removable", () => {
    const settings = { model: { name: 'qwen3-coder-plus' }, hooks: { Stop: [userHook] } }
    const once = mergeOurHooks(settings, options, 'qwen-settings')
    expect(mergeOurHooks(once, options, 'qwen-settings')).toEqual(once)
    expect(Object.keys(once.hooks).sort()).toEqual(Object.keys(QWEN_HOOK_EVENTS).sort())
    expect(once.hooks.StopFailure?.at(-1)?.hooks[0]?.command).toContain("/hooks/Stop'")
    const permission = once.hooks.PermissionRequest?.at(-1)?.hooks[0]
    expect(permission?.type).toBe('command')
    expect(permission?.command).not.toContain('-o /dev/null')
    expect(permission?.timeout).toBe(310)
    for (const groups of Object.values(once.hooks)) {
      const ours = groups.at(-1)?.hooks[0]
      expect(ours && isOurHook(ours)).toBe(true)
    }
    expect(removeOurHooks(once)).toEqual(settings)
  })

  test('install writes settings.json with a backup; doctor sees it', async () => {
    const configDir = join(home.dir(), '.qwen')
    await mkdir(configDir, { recursive: true })
    const profile: Profile = { id: 'qw', name: 'Qwen', configDir, color: '', agent: 'qwen' }
    const path = join(configDir, 'settings.json')
    expect(settingsPath(profile)).toBe(path)
    await writeFile(path, JSON.stringify({ hooks: { Stop: [userHook] } }))
    expect(await installHooks(profile, options)).toBe(true)
    expect(await installHooks(profile, options)).toBe(false)
    expect(await hasOurHooks(profile)).toBe(true)
    await uninstallHooks(profile)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ hooks: { Stop: [userHook] } })
  })
})

describe('qwen permissions', () => {
  test('Allow / Deny only, with a bare decision', async () => {
    const sent: ServerMessage[] = []
    const broker = new PermissionBroker(
      { broadcast: (m) => sent.push(m) },
      {
        timeoutMs: 5_000,
        defaultScope: 'project',
        profiles: [{ id: 'qw', name: 'Q', configDir: '/q', color: '', agent: 'qwen' }],
        denyMessage: 'Denied from the phone',
        keepPlanningMessage: 'keep planning',
      },
    )
    const hook = hookEvent(
      'PermissionRequest',
      { session_id: id, cwd: '/w', tool_name: 'run_shell_command', tool_input: { command: 'pnpm test' } },
      { profileId: 'qw' },
    )
    const answer = broker.handle(hook, new AbortController().signal)
    await Promise.resolve()
    const info = sent.flatMap((m) =>
      m.type === 'permission.request' ? [m.request] : [],
    )[0] as PermissionRequestInfo
    expect(info).toMatchObject({ suggestedRule: null, rules: false })
    expect(() =>
      broker.respond(info.requestId, {
        behavior: 'allow',
        always: { rule: 'Bash(pnpm:*)', scope: 'project' },
      }),
    ).toThrow(/does not take permission rules/)
    broker.respond(info.requestId, { behavior: 'allow' })
    expect(await answer).toEqual({
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } },
    })
  })
})
