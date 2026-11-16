import { homedir } from 'node:os'
import { DIAGNOSTICS_LIMIT, type ErrorCode, type RejectedRequest } from '@remote-harness/protocol'
import { paths } from '../../core/paths.ts'
import { DAEMON_VERSION } from '../../core/version.ts'
import type { DaemonContext } from '../../main.ts'
import { readComputerLogs } from './logs.ts'

/** The last rejected requests, kept in memory for "Report a problem" on the phone. */
export class RejectionLog {
  private readonly entries: RejectedRequest[] = []

  constructor(private readonly limit = DIAGNOSTICS_LIMIT) {}

  push(entry: RejectedRequest): void {
    this.entries.push(entry)
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit)
  }

  /** Most recent first. */
  recent(): RejectedRequest[] {
    return [...this.entries].reverse()
  }
}

export function registerDiagnosticsFeature(
  ctx: Pick<DaemonContext, 'router' | 'diagnosticsDevices'>,
  now: () => Date = () => new Date(),
  logs: { dir: () => string; home: string } = { dir: paths.logs, home: homedir() },
) {
  // The paired devices and their last app build, the asking one marked (#591).
  const devices = ctx.diagnosticsDevices
  const log = new RejectionLog()
  ctx.router.onRejected((type: string, code: ErrorCode) =>
    log.push({ at: now().toISOString(), type: type.slice(0, 64), code }),
  )
  ctx.router.register('diagnostics.errors', (_msg, connection) => ({
    type: 'diagnostics.result',
    daemonVersion: DAEMON_VERSION,
    errors: log.recent(),
    ...(devices ? { devices: devices(connection.deviceId) } : {}),
  }))
  // Only to the connection that asked: the reply goes nowhere else, and nothing of it is logged.
  ctx.router.register('diagnostics.logs', async () => ({
    type: 'diagnostics.logs.result',
    files: await readComputerLogs(logs.dir(), logs.home),
  }))
  return { log }
}
