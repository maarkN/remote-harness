import { z } from 'zod'

export const HOOK_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'Stop',
  'SubagentStop',
  'Notification',
  'PermissionRequest',
] as const

/**
 * Hook events with no Claude Code equivalent: the mirror image of `Notification`/`SubagentStop`,
 * which Codex's own hooks.json has no use for either. `Interrupt` fires when a Codex turn pauses
 * instead of finishing cleanly (e.g. to ask the user a question), so the daemon needs it even
 * though Claude Code's `settings.json` installer never offers it.
 */
export const CODEX_ONLY_HOOK_EVENTS = ['Interrupt'] as const

/**
 * The agent is about to show its own approval dialog, which no hook can answer (Gemini CLI's
 * `Notification`): the phone's answer is typed into the pane (see `AgentAdapter.approvalDialog`).
 */
export const DIALOG_HOOK_EVENTS = ['PermissionDialog'] as const

export type HookEventName =
  | (typeof HOOK_EVENTS)[number]
  | (typeof CODEX_ONLY_HOOK_EVENTS)[number]
  | (typeof DIALOG_HOOK_EVENTS)[number]

export function isHookEventName(value: string): value is HookEventName {
  return (
    (HOOK_EVENTS as readonly string[]).includes(value) ||
    (CODEX_ONLY_HOOK_EVENTS as readonly string[]).includes(value) ||
    (DIALOG_HOOK_EVENTS as readonly string[]).includes(value)
  )
}

/** Fields shared by every hook payload. Unknown fields are kept (`loose`) for feature-specific use. */
export const HookPayloadSchema = z.looseObject({
  session_id: z.string().min(1),
  transcript_path: z.string().optional(),
  cwd: z.string().optional(),
  permission_mode: z.string().optional(),
  hook_event_name: z.string().optional(),
})
export type HookPayload = z.infer<typeof HookPayloadSchema>

/** A hook delivered to the daemon, enriched with the tmux pane and profile it came from. */
export type HookEvent = {
  event: HookEventName
  payload: HookPayload
  /** tmux pane id (`%12`) when the session runs inside tmux. */
  paneId: string | null
  profileId: string | null
  receivedAt: string
}
