import { randomUUID } from 'node:crypto'
import type { CommandEndReason, ServerMessageOf } from '@remote-harness/protocol'
import type { ShellCommandsConfig } from '../../core/config.ts'
import { DaemonError } from '../../core/errors.ts'
import type { Logger } from '../../core/logger.ts'
import type { ShellExit, ShellProcess, ShellSpawner } from '../../infra/shell.ts'
import type { Connection } from '../../transport/connection.ts'
import type { SessionStore } from '../sessions/store.ts'
import { OutputCollector } from './output.ts'

/** Runs at once across every session (each session has at most one). */
export const MAX_RUNS = 4
/** Output is sent in batches: at most this often… */
export const FLUSH_INTERVAL_MS = 50
/** …or as soon as this many characters wait. */
export const FLUSH_CHARS = 16 * 1024

type Run = {
  id: string
  sessionId: string
  connection: Connection
  process: ShellProcess
  output: OutputCollector
  startedAt: number
  /** Set when the daemon killed the run; the exit then reports it instead of `exited`. */
  reason: CommandEndReason | null
  timeout: NodeJS.Timeout
  flush: NodeJS.Timeout | null
}

export type ShellServiceDeps = {
  store: Pick<SessionStore, 'get'>
  spawn: ShellSpawner
  /** Current `shellCommands` config (re-read on `/admin/commands-reload`). */
  settings: () => ShellCommandsConfig
  isDirectory: (path: string) => Promise<boolean>
  logger: Logger
  now?: () => number
}

/**
 * Shell commands from the app, gated by the config opt-in. Output goes only to the connection that
 * started the run; the log never gets the command nor its output.
 */
export class ShellCommandService {
  private readonly runs = new Map<string, Run>()
  /** Connections whose close already cancels their runs. */
  private readonly watched = new WeakSet<Connection>()
  private readonly now: () => number

  constructor(private readonly deps: ShellServiceDeps) {
    this.now = deps.now ?? Date.now
  }

  get enabled(): boolean {
    return this.deps.settings().enabled
  }

  async run(
    sessionId: string,
    command: string,
    connection: Connection,
  ): Promise<Omit<ServerMessageOf<'command.started'>, 'type' | 'replyTo'>> {
    const settings = this.deps.settings()
    if (!settings.enabled)
      throw new DaemonError('commands_disabled', 'shell commands are off on this computer')
    const session = this.deps.store.get(sessionId)
    if (!session) throw new DaemonError('not_found', `session ${sessionId} not found`)
    if (!session.cwd || !(await this.deps.isDirectory(session.cwd)))
      throw new DaemonError('invalid_cwd', 'the session folder does not exist')
    const runs = [...this.runs.values()]
    if (runs.some((run) => run.sessionId === sessionId))
      throw new DaemonError('session_busy', 'a command is already running in this session')
    if (runs.length >= MAX_RUNS) throw new DaemonError('session_busy', 'too many commands running')

    const id = randomUUID()
    const process = this.deps.spawn(command, { cwd: session.cwd })
    const run: Run = {
      id,
      sessionId,
      connection,
      process,
      output: new OutputCollector(settings.maxOutputKb * 1024),
      startedAt: this.now(),
      reason: null,
      timeout: setTimeout(() => this.kill(run, 'timeout'), settings.timeoutSec * 1000),
      flush: null,
    }
    run.timeout.unref()
    this.runs.set(id, run)
    if (!this.watched.has(connection)) {
      this.watched.add(connection)
      connection.onClose(() => {
        for (const other of this.runs.values())
          if (other.connection === connection) this.kill(other, 'cancelled')
      })
    }
    process.onData((stream, chunk) => {
      if (!run.output.push(stream, chunk)) this.kill(run, 'output_limit')
      this.scheduleFlush(run)
    })
    process.onExit((exit) => this.finish(run, exit))
    return { runId: id, cwd: session.cwd }
  }

  /** Cancels a run of this connection; another connection's run is `not_found`. */
  cancel(runId: string, connection: Connection): void {
    const run = this.runs.get(runId)
    if (!run || run.connection !== connection) throw new DaemonError('not_found', `run ${runId} not found`)
    this.kill(run, 'cancelled')
  }

  dispose(): void {
    for (const run of this.runs.values()) this.kill(run, 'cancelled')
  }

  private kill(run: Run, reason: CommandEndReason): void {
    if (!this.runs.has(run.id) || run.reason) return
    run.reason = reason
    run.process.kill()
  }

  private scheduleFlush(run: Run): void {
    if (run.output.pendingSize >= FLUSH_CHARS) {
      this.flush(run)
      return
    }
    if (run.flush) return
    run.flush = setTimeout(() => this.flush(run), FLUSH_INTERVAL_MS)
  }

  private flush(run: Run, end = false): void {
    if (run.flush) clearTimeout(run.flush)
    run.flush = null
    for (const chunk of run.output.take(end))
      run.connection.send({ type: 'command.output', runId: run.id, ...chunk })
  }

  private finish(run: Run, exit: ShellExit): void {
    if (!this.runs.delete(run.id)) return
    clearTimeout(run.timeout)
    this.flush(run, true)
    const reason: CommandEndReason = exit.error ? 'failed' : (run.reason ?? 'exited')
    const durationMs = this.now() - run.startedAt
    const exitCode = reason === 'exited' ? exit.exitCode : null
    run.connection.send({
      type: 'command.exit',
      runId: run.id,
      exitCode,
      signal: exit.signal,
      reason,
      durationMs,
      truncated: run.output.truncated,
    })
    // Never the command nor its output: they can carry secrets.
    this.deps.logger.info(
      { sessionId: run.sessionId, runId: run.id, reason, exitCode, durationMs, bytes: run.output.bytes },
      'command ran',
    )
  }
}
