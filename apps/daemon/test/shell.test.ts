import type { CommandStream, ServerMessage } from '@remote-harness/protocol'
import { pino } from 'pino'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ConfigSchema, SHELL_COMMANDS_DEFAULTS, type ShellCommandsConfig } from '../src/core/config.ts'
import { DaemonError } from '../src/core/errors.ts'
import { OutputCollector, stripAnsi } from '../src/features/shell/output.ts'
import { FLUSH_INTERVAL_MS, MAX_RUNS, ShellCommandService } from '../src/features/shell/service.ts'
import { type ShellExit, type ShellProcess, shellInvocation, spawnShell } from '../src/infra/shell.ts'
import { fakeConnection } from './helpers.ts'

describe('shellCommands config', () => {
  const profiles = [{ id: 'p', name: 'P', configDir: '~/.claude', color: '#D97757' }]
  test('off by default, with bounded limits', () => {
    expect(ConfigSchema.parse({ profiles }).shellCommands).toEqual({
      enabled: false,
      timeoutSec: 300,
      maxOutputKb: 1024,
    })
    expect(ConfigSchema.parse({ profiles, shellCommands: { enabled: true } }).shellCommands.enabled).toBe(
      true,
    )
    expect(ConfigSchema.safeParse({ profiles, shellCommands: { timeoutSec: 7200 } }).success).toBe(false)
    expect(ConfigSchema.safeParse({ profiles, shellCommands: { maxOutputKb: 0 } }).success).toBe(false)
  })
})

describe('command output', () => {
  test('ANSI escapes are removed', () => {
    expect(stripAnsi('\u001b[32mok\u001b[0m \u001b]0;title\u0007done\u001b[2K')).toBe('ok done')
  })

  test('UTF-8 split across chunks stays whole; same-stream neighbors merge', () => {
    const output = new OutputCollector(1024)
    const bytes = Buffer.from('ação', 'utf8')
    output.push('stdout', bytes.subarray(0, 2))
    output.push('stdout', bytes.subarray(2))
    output.push('stderr', Buffer.from('warn'))
    output.push('stdout', Buffer.from('!'))
    expect(output.take()).toEqual([
      { stream: 'stdout', text: 'ação' },
      { stream: 'stderr', text: 'warn' },
      { stream: 'stdout', text: '!' },
    ])
    expect(output.take()).toEqual([])
  })

  test('the cap counts both streams and drops the rest', () => {
    const output = new OutputCollector(10)
    expect(output.push('stdout', Buffer.from('12345'))).toBe(true)
    expect(output.push('stderr', Buffer.from('6789abc'))).toBe(false)
    expect(output.push('stdout', Buffer.from('more'))).toBe(false)
    expect(output.bytes).toBe(10)
    expect(output.truncated).toBe(true)
    expect(output.take(true).map((c) => c.text)).toEqual(['12345', '6789a'])
  })
})

type FakeProcess = ShellProcess & {
  command: string
  cwd: string
  killed: number
  emit(stream: CommandStream, text: string): void
  exit(exit: ShellExit): void
}

function fakeSpawner() {
  const spawned: FakeProcess[] = []
  const spawn = (command: string, { cwd }: { cwd: string }): ShellProcess => {
    const data: Array<(stream: CommandStream, chunk: Buffer) => void> = []
    const exits: Array<(exit: ShellExit) => void> = []
    const process: FakeProcess = {
      command,
      cwd,
      killed: 0,
      onData: (listener) => data.push(listener),
      onExit: (listener) => exits.push(listener),
      kill: () => {
        process.killed += 1
      },
      emit: (stream, text) => {
        for (const listener of data) listener(stream, Buffer.from(text))
      },
      exit: (exit) => {
        for (const listener of exits) listener(exit)
      },
    }
    spawned.push(process)
    return process
  }
  return { spawn, spawned }
}

function setup(overrides: Partial<ShellCommandsConfig> = {}) {
  const { spawn, spawned } = fakeSpawner()
  const settings: ShellCommandsConfig = { ...SHELL_COMMANDS_DEFAULTS, enabled: true, ...overrides }
  const logs: string[] = []
  const logger = pino({ level: 'info' }, { write: (line: string) => logs.push(line) })
  const sessions: Record<string, { cwd: string }> = { s1: { cwd: '/work' }, s2: { cwd: '/work' } }
  let now = 1_000
  const service = new ShellCommandService({
    store: { get: (id: string) => sessions[id] as never },
    spawn,
    settings: () => settings,
    isDirectory: async (path) => path === '/work',
    logger,
    now: () => now,
  })
  return {
    service,
    spawned,
    settings,
    logs,
    sessions,
    advance: (ms: number) => {
      now += ms
    },
  }
}

const sent = (messages: ServerMessage[], type: ServerMessage['type']) =>
  messages.filter((m) => m.type === type)

describe('ShellCommandService', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('off by default: nothing runs', async () => {
    const { service, spawned } = setup({ enabled: false })
    await expect(service.run('s1', 'ls', fakeConnection())).rejects.toMatchObject({
      code: 'commands_disabled',
    })
    expect(spawned).toHaveLength(0)
  })

  test('unknown session, missing folder', async () => {
    const { service, sessions } = setup()
    await expect(service.run('nope', 'ls', fakeConnection())).rejects.toMatchObject({ code: 'not_found' })
    sessions.s1 = { cwd: '/gone' }
    await expect(service.run('s1', 'ls', fakeConnection())).rejects.toMatchObject({ code: 'invalid_cwd' })
  })

  test('runs in the session folder and streams output then the exit to its connection only', async () => {
    vi.useFakeTimers()
    const { service, spawned, advance } = setup()
    const conn = fakeConnection()
    const started = await service.run('s1', 'git status', conn)
    expect(started).toEqual({ runId: expect.any(String), cwd: '/work' })
    expect(spawned[0]).toMatchObject({ command: 'git status', cwd: '/work' })
    spawned[0]?.emit('stdout', 'On branch main\n')
    spawned[0]?.emit('stderr', 'hint\n')
    expect(sent(conn.sent, 'command.output')).toHaveLength(0)
    vi.advanceTimersByTime(FLUSH_INTERVAL_MS)
    expect(sent(conn.sent, 'command.output')).toEqual([
      { type: 'command.output', runId: started.runId, stream: 'stdout', text: 'On branch main\n' },
      { type: 'command.output', runId: started.runId, stream: 'stderr', text: 'hint\n' },
    ])
    spawned[0]?.emit('stdout', 'tail')
    advance(1_500)
    spawned[0]?.exit({ exitCode: 0, signal: null })
    // Pending output goes out before the exit.
    expect(conn.sent.slice(-2)).toEqual([
      { type: 'command.output', runId: started.runId, stream: 'stdout', text: 'tail' },
      {
        type: 'command.exit',
        runId: started.runId,
        exitCode: 0,
        signal: null,
        reason: 'exited',
        durationMs: 1_500,
        truncated: false,
      },
    ])
  })

  test('one run per session, a few in total', async () => {
    const { service, sessions } = setup()
    await service.run('s1', 'sleep 9', fakeConnection())
    await expect(service.run('s1', 'ls', fakeConnection())).rejects.toMatchObject({ code: 'session_busy' })
    for (let i = 2; i <= MAX_RUNS; i++) {
      sessions[`x${i}`] = { cwd: '/work' }
      await service.run(`x${i}`, 'sleep 9', fakeConnection())
    }
    await expect(service.run('s2', 'ls', fakeConnection())).rejects.toMatchObject({ code: 'session_busy' })
  })

  test('the output cap kills the run and marks it truncated', async () => {
    const { service, spawned } = setup({ maxOutputKb: 1 })
    const conn = fakeConnection()
    await service.run('s1', 'yes', conn)
    spawned[0]?.emit('stdout', 'y\n'.repeat(400))
    expect(spawned[0]?.killed).toBe(0)
    spawned[0]?.emit('stdout', 'y\n'.repeat(400))
    expect(spawned[0]?.killed).toBe(1)
    spawned[0]?.exit({ exitCode: null, signal: 'SIGTERM' })
    const text = sent(conn.sent, 'command.output')
      .map((m) => (m.type === 'command.output' ? m.text : ''))
      .join('')
    expect(text).toHaveLength(1024)
    expect(sent(conn.sent, 'command.exit')[0]).toMatchObject({
      reason: 'output_limit',
      truncated: true,
      exitCode: null,
      signal: 'SIGTERM',
    })
  })

  test('timeout', async () => {
    vi.useFakeTimers()
    const { service, spawned } = setup({ timeoutSec: 5 })
    const conn = fakeConnection()
    await service.run('s1', 'sleep 60', conn)
    vi.advanceTimersByTime(5_000)
    expect(spawned[0]?.killed).toBe(1)
    spawned[0]?.exit({ exitCode: null, signal: 'SIGTERM' })
    expect(sent(conn.sent, 'command.exit')[0]).toMatchObject({ reason: 'timeout', exitCode: null })
  })

  test('cancel by its connection; another one cannot; closing the connection cancels', async () => {
    const { service, spawned } = setup()
    const conn = fakeConnection()
    const other = { ...fakeConnection(), id: 'conn-2' }
    const { runId } = await service.run('s1', 'sleep 60', conn)
    expect(() => service.cancel(runId, other)).toThrow(DaemonError)
    service.cancel(runId, conn)
    expect(spawned[0]?.killed).toBe(1)
    spawned[0]?.exit({ exitCode: null, signal: 'SIGTERM' })
    expect(sent(conn.sent, 'command.exit')[0]).toMatchObject({ reason: 'cancelled' })
    expect(other.sent).toEqual([])

    await service.run('s2', 'sleep 60', conn)
    conn.closeAll()
    expect(spawned[1]?.killed).toBe(1)
  })

  test('a shell that cannot start ends as failed', async () => {
    const { service, spawned } = setup()
    const conn = fakeConnection()
    await service.run('s1', 'ls', conn)
    spawned[0]?.exit({ exitCode: null, signal: null, error: new Error('spawn ENOENT') })
    expect(sent(conn.sent, 'command.exit')[0]).toMatchObject({ reason: 'failed', exitCode: null })
  })

  test('the log says a command ran, never the command or its output', async () => {
    const { service, spawned, logs } = setup()
    const conn = fakeConnection()
    await service.run('s1', 'curl -H "Authorization: secret-token" https://x', conn)
    spawned[0]?.emit('stdout', 'private body')
    spawned[0]?.exit({ exitCode: 0, signal: null })
    expect(logs.join('')).toContain('command ran')
    expect(logs.join('')).not.toContain('secret-token')
    expect(logs.join('')).not.toContain('private body')
  })
})

describe('shell executor', () => {
  test('login shell when $SHELL is absolute, else /bin/sh', () => {
    expect(shellInvocation('ls', { SHELL: '/bin/zsh' })).toEqual(['/bin/zsh', ['-lc', 'ls']])
    expect(shellInvocation('ls', {})).toEqual(['/bin/sh', ['-c', 'ls']])
    expect(shellInvocation('ls', { SHELL: 'zsh' })).toEqual(['/bin/sh', ['-c', 'ls']])
  })

  function collect(process: ShellProcess) {
    const chunks: { stream: CommandStream; text: string }[] = []
    process.onData((stream, chunk) => chunks.push({ stream, text: chunk.toString() }))
    const exit = new Promise<ShellExit>((resolve) => process.onExit(resolve))
    return { chunks, exit }
  }

  test('runs in the folder with both streams and the exit code', async () => {
    const previous = process.env.SHELL
    process.env.SHELL = '/bin/sh'
    try {
      const run = collect(spawnShell('pwd; echo oops >&2; exit 3', { cwd: '/tmp' }))
      const exit = await run.exit
      expect(exit).toMatchObject({ exitCode: 3 })
      expect(
        run.chunks
          .filter((c) => c.stream === 'stdout')
          .map((c) => c.text)
          .join(''),
      ).toMatch(/tmp\n$/)
      expect(
        run.chunks
          .filter((c) => c.stream === 'stderr')
          .map((c) => c.text)
          .join(''),
      ).toBe('oops\n')
    } finally {
      process.env.SHELL = previous
    }
  })

  test('kill ends the whole process group, background jobs included', async () => {
    const child = spawnShell('sleep 30 & sleep 30; wait', { cwd: '/tmp' })
    const run = collect(child)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const killedAt = Date.now()
    child.kill()
    const exit = await run.exit
    expect(exit.signal).toBe('SIGTERM')
    expect(Date.now() - killedAt).toBeLessThan(2_000)
  })
})
