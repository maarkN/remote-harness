import type { PermissionOutcome, SessionState } from '@remote-harness/protocol'

/** Notifications that do not mean the agent waits for the user. */
export const NOTIFICATIONS_NOT_WAITING = new Set(['auth_success', 'agent_completed'])

/**
 * Background task types (Claude Code's labels in `background_tasks`) that are agents still at work.
 * Background shells and monitors are left out: a dev server or a watch can run for hours while the
 * session takes prompts.
 */
const AGENT_TASK_TYPES = new Set(['subagent', 'workflow'])
/** Statuses of a task that is no longer in flight, in case a finished one is still listed. */
const FINAL_TASK_STATUSES = new Set(['completed', 'failed', 'killed', 'cancelled', 'stopped'])

/**
 * Whether the `background_tasks` of a `Stop`/`SubagentStop` still lists agent work in flight (a
 * workflow run, a background subagent): the turn ended but the session is not done. Tolerant of
 * unknown shapes, which count as no agent work.
 */
export function agentWorkInFlight(backgroundTasks: unknown): boolean {
  if (!Array.isArray(backgroundTasks)) return false
  return backgroundTasks.some((task: unknown) => {
    if (typeof task !== 'object' || task === null) return false
    const { type, status } = task as { type?: unknown; status?: unknown }
    return (
      typeof type === 'string' &&
      AGENT_TASK_TYPES.has(type) &&
      !(typeof status === 'string' && FINAL_TASK_STATUSES.has(status))
    )
  })
}

/** The state a hook moves a session to, or undefined when it does not change it. */
export function hookState(
  event: string,
  notificationType?: unknown,
  backgroundTasks?: unknown,
): SessionState | undefined {
  switch (event) {
    case 'Stop':
      // The turn ended but agents still work in the background: idle once a later Stop has none.
      return agentWorkInFlight(backgroundTasks) ? 'running' : 'idle'
    case 'SessionStart':
    // Codex: the turn paused instead of finishing cleanly (e.g. to ask the user a question); the
    // session is just as ready for the next prompt as it is after a Stop.
    case 'Interrupt':
      return 'idle'
    case 'UserPromptSubmit':
      return 'running'
    case 'PermissionRequest':
    // Gemini CLI: its approval dialog is about to show (answered through the pane).
    case 'PermissionDialog':
      return 'waiting'
    case 'Notification':
      return typeof notificationType === 'string' && NOTIFICATIONS_NOT_WAITING.has(notificationType)
        ? undefined
        : 'waiting'
    case 'SessionEnd':
      return 'ended'
    default:
      return undefined
  }
}

/**
 * Hooks that bring an ended session back: a new start (resume, `/clear`), or a prompt typed in a tmux
 * pane (only a live session sends one).
 */
export function revives(event: string, hasPane: boolean): boolean {
  return event === 'SessionStart' || (event === 'UserPromptSubmit' && hasPane)
}

/**
 * Whether a hook may change the session's state, pane and controllability. An ended session ignores
 * late hooks (an idle notification or a `Stop` delivered after `SessionEnd`) until it is revived.
 */
export function acceptsHook(
  current: { state: SessionState } | undefined,
  event: string,
  hasPane: boolean,
): boolean {
  return current?.state !== 'ended' || revives(event, hasPane)
}

/** A resolved permission request means the agent works again, unless the session is gone or ended. */
export function stateAfterPermission(current: { state: SessionState } | undefined): SessionState | undefined {
  return current && current.state !== 'ended' ? 'running' : undefined
}

/**
 * The state a resolution leaves: running again after an answer from a device, or after one in the
 * terminal when the turn went on (`continued`); otherwise the session's hooks decide.
 */
export function stateAfterResolution(
  current: { state: SessionState } | undefined,
  outcome: PermissionOutcome,
  continued = false,
): SessionState | undefined {
  if (outcome !== 'allowed' && outcome !== 'denied' && !continued) return undefined
  return stateAfterPermission(current)
}

/** True when a change moved a session into `ended`. */
export function justEnded(
  next: { state: SessionState },
  previous: { state: SessionState } | undefined,
): boolean {
  return next.state === 'ended' && previous !== undefined && previous.state !== 'ended'
}
