import { CodexPresetSchema, type PermissionMode, SelectableModeSchema } from '@remote-harness/protocol'
import { DaemonError } from '../../core/errors.ts'
import type { KeyedMutex } from '../../core/keyed-mutex.ts'
import type { TmuxClient } from '../../infra/tmux.ts'
import { adapterOf } from '../agents/index.ts'
import { requireControllable } from '../input/service.ts'
import type { SessionStore } from '../sessions/store.ts'
import { detectMode } from './detect.ts'

/** Upper bound for one full Shift+Tab cycle (default, acceptEdits, plan, bypass, auto, + slack). */
export const MAX_MODE_PRESSES = 6

/** Requests never honored remotely, whatever the agent: full access without approvals. */
const FORBIDDEN_MODES = new Set([
  'bypassPermissions',
  'full-access',
  'danger-full-access',
  ':danger-full-access',
])

export type ModeOptions = {
  settleMs?: number
  sleep?: (ms: number) => Promise<void>
  /** Submits a command in a session's pane (Codex \`/permissions\`), like a prompt from the app. */
  submit?: (sessionId: string, text: string) => Promise<void>
}

/**
 * Switches Claude Code's permission modes with Shift+Tab, re-reading the status line after every
 * press, and Codex's permission presets with \`/permissions <id>\`.
 */
export class ModeService {
  private readonly sleep: (ms: number) => Promise<void>
  private readonly settleMs: number
  private readonly submit: (sessionId: string, text: string) => Promise<void>

  constructor(
    private readonly tmux: TmuxClient,
    private readonly store: SessionStore,
    private readonly lock: KeyedMutex,
    private readonly hasPendingPermission: (sessionId: string) => boolean,
    options: ModeOptions = {},
  ) {
    this.settleMs = options.settleMs ?? 150
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.submit =
      options.submit ??
      (async () => {
        throw new DaemonError('internal', 'commands cannot be submitted')
      })
  }

  /** \`session.setMode\`: a Claude Code mode, or a permission preset for agents that have them (Codex). */
  async change(
    sessionId: string,
    requested: string,
  ): Promise<{ permissionMode: PermissionMode } | { permissionProfile: string }> {
    const session = this.store.get(sessionId)
    if (session && adapterOf(session.agent).presets)
      return { permissionProfile: await this.setPreset(sessionId, requested) }
    return { permissionMode: await this.setMode(sessionId, requested) }
  }

  /**
   * Submits the preset's command and answers the profile it asks for. The session's
   * \`permissionProfile\` only changes when the agent records the switch in its transcript.
   */
  async setPreset(sessionId: string, requested: string): Promise<string> {
    if (FORBIDDEN_MODES.has(requested))
      throw new DaemonError('mode_forbidden', `${requested} is not available remotely`)
    const { agent } = requireControllable(this.store, sessionId)
    const adapter = adapterOf(agent)
    if (!adapter.presets) throw new DaemonError('bad_request', `${adapter.name} has no permission presets`)
    const parsed = CodexPresetSchema.safeParse(requested)
    if (!parsed.success) throw new DaemonError('bad_request', `unknown preset ${requested}`)
    if (this.hasPendingPermission(sessionId))
      throw new DaemonError('session_busy', 'a permission dialog is open')
    await this.submit(sessionId, adapter.presets.command(parsed.data))
    return `:${parsed.data}`
  }

  async read(sessionId: string): Promise<PermissionMode> {
    const { paneId } = requireControllable(this.store, sessionId)
    const mode = detectMode(await this.tmux.capturePane(paneId))
    this.store.upsert(sessionId, { permissionMode: mode })
    return mode
  }

  async setMode(sessionId: string, requested: string): Promise<PermissionMode> {
    if (FORBIDDEN_MODES.has(requested))
      throw new DaemonError('mode_forbidden', `${requested} is not available remotely`)
    const parsed = SelectableModeSchema.safeParse(requested)
    if (!parsed.success) throw new DaemonError('bad_request', `unknown mode ${requested}`)
    const target = parsed.data
    const { paneId, agent } = requireControllable(this.store, sessionId)
    if (!adapterOf(agent).modes)
      throw new DaemonError('bad_request', `${adapterOf(agent).name} modes cannot be changed from the app`)
    if (this.hasPendingPermission(sessionId))
      throw new DaemonError('session_busy', 'a permission dialog is open')

    return this.lock.run(sessionId, async () => {
      let current = detectMode(await this.tmux.capturePane(paneId))
      for (let presses = 0; current !== target && presses < MAX_MODE_PRESSES; presses++) {
        await this.tmux.sendKeys(paneId, ['BTab'])
        await this.sleep(this.settleMs)
        current = detectMode(await this.tmux.capturePane(paneId))
        // Never rest on bypass: keep cycling past it.
      }
      if (current === 'bypassPermissions') {
        await this.tmux.sendKeys(paneId, ['BTab'])
        await this.sleep(this.settleMs)
        current = detectMode(await this.tmux.capturePane(paneId))
      }
      this.store.upsert(sessionId, { permissionMode: current })
      if (current !== target) {
        throw new DaemonError(
          'mode_unreachable',
          `mode ${target} not reachable; current mode is ${current}`,
          {
            permissionMode: current,
          },
        )
      }
      return current
    })
  }
}
