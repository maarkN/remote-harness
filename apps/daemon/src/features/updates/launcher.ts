import type { DaemonUpdateChannel } from '@remote-harness/protocol'
import { runDetachedUpdate } from '../../infra/desktop.ts'
import type { AvailableUpdate } from './checker.ts'
import { type LaunchRefusal, type LaunchResult, launchRefusal, REFUSAL_MESSAGES } from './remote.ts'

export type UpdateLauncherDeps = {
  /** dist/cli.js of this build (null from sources). */
  cliPath: string | null
  /** The daemon runs from the installer's checkout. */
  installer: boolean
  available: () => AvailableUpdate | null
  channel: () => DaemonUpdateChannel
  /** A run in the record still goes on (whoever started it). */
  recordedRun: () => boolean
  logFile: string
  /** Under systemd the updater runs as a transient unit. */
  systemdRun: boolean
  /** The updater was spawned. */
  onStart?: (available: AvailableUpdate) => void
  /** The updater exited (any code) or could not be spawned. */
  onExit?: (code: number | null, available: AvailableUpdate) => void
  spawnUpdate?: typeof runDetachedUpdate
}

/**
 * Starts the detached `remote-harness update` for the app, the tray and automatic updates, and knows
 * whether the one it spawned still runs.
 */
export class UpdateLauncher {
  private spawned = false

  constructor(private readonly deps: UpdateLauncherDeps) {}

  /** This process spawned the updater and it has not exited. */
  get updating(): boolean {
    return this.spawned
  }

  /** A followed run finished while this daemon still runs: the updater did not replace it. */
  finished(): void {
    this.spawned = false
  }

  /** Why an update cannot start now, counting a run in the record (checked before one is recorded). */
  refusal(): LaunchRefusal | null {
    return this.refusalOf(this.spawned || this.deps.recordedRun())
  }

  /**
   * Spawns the updater. `RemoteUpdates.begin` checked `refusal()` and recorded the new run just
   * before, so the record is not a reason to refuse here: only what changed since (an updater this
   * process spawned meanwhile, an offer that went away).
   */
  launch(onFailure: (code: number | null) => void): LaunchResult {
    const available = this.deps.available()
    const cliPath = this.deps.cliPath
    const refused = this.refusalOf(this.spawned)
    if (refused || !available || !cliPath) {
      const reason = refused ?? 'nothing'
      return { ok: false, refused: reason, error: REFUSAL_MESSAGES[reason] }
    }
    this.spawned = true
    try {
      ;(this.deps.spawnUpdate ?? runDetachedUpdate)({
        nodePath: process.execPath,
        cliPath,
        ref: this.deps.channel(),
        logFile: this.deps.logFile,
        systemdRun: this.deps.systemdRun,
        // A successful update restarts this daemon: still being here means it was not replaced, so
        // the next update must be able to start whatever the exit code. (Under systemd this is
        // `systemd-run`, which returns once the unit started: the run record tells the rest.)
        onExit: (code) => {
          this.spawned = false
          this.deps.onExit?.(code, available)
          if (code !== 0) onFailure(code)
        },
      })
    } catch (error) {
      this.spawned = false
      this.deps.onExit?.(null, available)
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
    this.deps.onStart?.(available)
    return { ok: true }
  }

  private refusalOf(updating: boolean): LaunchRefusal | null {
    return launchRefusal({
      updating,
      installer: this.deps.installer && this.deps.cliPath !== null,
      available: this.deps.available() !== null,
    })
  }
}
