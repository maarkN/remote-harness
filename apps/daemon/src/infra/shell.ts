import { spawn } from 'node:child_process'
import type { CommandStream } from '@remote-harness/protocol'

/** Time a process group gets to exit after SIGTERM before SIGKILL. */
export const KILL_GRACE_MS = 2_000
/** How long the pipes may stay open after the shell exited. */
const PIPE_DRAIN_MS = 1_000

/** How a shell process ended; `error` when it could not start at all. */
export type ShellExit = { exitCode: number | null; signal: string | null; error?: Error }

/** A running shell command. `kill` ends its whole process group (SIGTERM, then SIGKILL). */
export type ShellProcess = {
  onData(listener: (stream: CommandStream, chunk: Buffer) => void): void
  /** Called once, after the last data. */
  onExit(listener: (exit: ShellExit) => void): void
  kill(): void
}

export type ShellSpawner = (command: string, options: { cwd: string }) => ShellProcess

/** `$SHELL` when it is an absolute path (login shell: the user's PATH), else `/bin/sh`. */
export function shellInvocation(command: string, env: NodeJS.ProcessEnv = process.env): [string, string[]] {
  const shell = env.SHELL
  return shell?.startsWith('/') ? [shell, ['-lc', command]] : ['/bin/sh', ['-c', command]]
}

/**
 * Runs a command with the user's shell in its own process group, stdin closed, without color. The
 * only place that spawns arbitrary shell commands (the shell feature gates it behind the opt-in).
 */
export const spawnShell: ShellSpawner = (command, { cwd }) => {
  const [file, args] = shellInvocation(command)
  const child = spawn(file, args, {
    cwd,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, TERM: 'dumb', NO_COLOR: '1', FORCE_COLOR: '0' },
  })
  const dataListeners: Array<(stream: CommandStream, chunk: Buffer) => void> = []
  const exitListeners: Array<(exit: ShellExit) => void> = []
  let ended = false
  let killTimer: NodeJS.Timeout | null = null
  const finish = (exit: ShellExit) => {
    if (ended) return
    ended = true
    if (killTimer) clearTimeout(killTimer)
    for (const listener of exitListeners) listener(exit)
  }
  child.stdout?.on('data', (chunk: Buffer) => {
    for (const listener of dataListeners) listener('stdout', chunk)
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    for (const listener of dataListeners) listener('stderr', chunk)
  })
  child.on('error', (error) => finish({ exitCode: null, signal: null, error }))
  // `close` waits for the pipes, so every chunk was delivered before the exit.
  child.on('close', (code, signal) => finish({ exitCode: code, signal }))
  // A background job (`cmd &`) can keep the pipes open after the shell exited: stop waiting.
  child.on('exit', (code, signal) => {
    setTimeout(() => {
      child.stdout?.destroy()
      child.stderr?.destroy()
      finish({ exitCode: code, signal })
    }, PIPE_DRAIN_MS).unref()
  })

  const signalGroup = (signal: NodeJS.Signals) => {
    if (child.pid === undefined) return
    try {
      process.kill(-child.pid, signal)
    } catch {
      // already gone
    }
  }
  return {
    onData: (listener) => dataListeners.push(listener),
    onExit: (listener) => exitListeners.push(listener),
    kill: () => {
      if (ended || killTimer) return
      signalGroup('SIGTERM')
      killTimer = setTimeout(() => signalGroup('SIGKILL'), KILL_GRACE_MS)
      killTimer.unref()
    },
  }
}
