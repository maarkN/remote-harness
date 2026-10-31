import { SECRET_HEADER } from '../../transport/hooks-server.ts'
import { HOOK_EVENTS, type HookEventName } from './payloads.ts'
import { PANE_HEADER, PROFILE_HEADER } from './receiver.ts'

type HookEntry = { type: string; url?: string; command?: string; [key: string]: unknown }
type HookGroup = { matcher?: string; hooks: HookEntry[]; [key: string]: unknown }
type Settings = Record<string, unknown> & { hooks?: Record<string, HookGroup[]> }

const OUR_URL = /^http:\/\/127\.0\.0\.1:\d+\/hooks\//
const OUR_COMMAND = /^curl .* 'http:\/\/127\.0\.0\.1:\d+\/hooks\/\w+'/

/** Events where Claude Code runs only command hooks, so we post to the daemon with curl. */
const COMMAND_ONLY_EVENTS: ReadonlySet<HookEventName> = new Set(['SessionStart'])

export function isOurHook(entry: HookEntry): boolean {
  if (entry.type === 'http') return typeof entry.url === 'string' && OUR_URL.test(entry.url)
  return entry.type === 'command' && typeof entry.command === 'string' && OUR_COMMAND.test(entry.command)
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

export type HookInstallOptions = { port: number; secret: string; permissionTimeoutSec: number }

/**
 * Where the hooks are written: Claude Code's `settings.json`, Codex's `hooks.json` or Gemini CLI's
 * `settings.json` (same shape, Gemini's own event names).
 */
export type HookStyle = 'claude-settings' | 'codex-hooks' | 'gemini-hooks' | 'qwen-settings'

/**
 * Codex has no Notification or SubagentStop for us; the rest match Claude Code's names and stdin.
 * `Interrupt` is the other direction: a Codex-only event (a turn paused instead of finishing, e.g.
 * to ask the user a question) that Claude Code has no equivalent of.
 */
export const CODEX_HOOK_EVENTS: readonly HookEventName[] = [
  'SessionStart',
  'UserPromptSubmit',
  'PermissionRequest',
  'Stop',
  'Interrupt',
  'SessionEnd',
]

/**
 * Gemini CLI's events and the daemon events they are posted as. `BeforeAgent` carries the prompt and
 * `AfterAgent` ends the turn; `Notification` only announces a tool approval dialog.
 */
export const GEMINI_HOOK_EVENTS: Readonly<Record<string, HookEventName>> = {
  SessionStart: 'SessionStart',
  BeforeAgent: 'UserPromptSubmit',
  AfterAgent: 'Stop',
  Notification: 'PermissionDialog',
  SessionEnd: 'SessionEnd',
}

/**
 * Qwen Code's events (Claude Code's names) and the daemon events they are posted as; `StopFailure`
 * ends a turn that failed, which leaves the session as ready as `Stop`.
 */
export const QWEN_HOOK_EVENTS: Readonly<Record<string, HookEventName>> = {
  SessionStart: 'SessionStart',
  UserPromptSubmit: 'UserPromptSubmit',
  PermissionRequest: 'PermissionRequest',
  Notification: 'Notification',
  Stop: 'Stop',
  StopFailure: 'Stop',
  SessionEnd: 'SessionEnd',
}

/** The hooks a style installs: the key in the hooks file and the daemon event it posts. */
export function hookEventsFor(style: HookStyle): readonly (readonly [string, HookEventName])[] {
  if (style === 'gemini-hooks') return Object.entries(GEMINI_HOOK_EVENTS)
  if (style === 'qwen-settings') return Object.entries(QWEN_HOOK_EVENTS)
  return (style === 'codex-hooks' ? CODEX_HOOK_EVENTS : HOOK_EVENTS).map((event) => [event, event] as const)
}

function curlHeaders(secret: string): string {
  return [
    `${SECRET_HEADER}: ${secret}`,
    `${PANE_HEADER}: $TMUX_PANE`,
    `${PROFILE_HEADER}: $CLAUDE_REMOTE_PROFILE`,
  ]
    .map((h) => `-H "${h}"`)
    .join(' ')
}

/**
 * Codex runs command hooks only (`$SHELL -lc`, the event JSON on stdin, Codex's environment, so
 * `$TMUX_PANE` and the launcher's profile are set). The permission hook prints the daemon's answer;
 * an empty answer (daemon down, timeout) lets Codex show its own prompt. `SessionEnd` hooks get at
 * most 3 seconds.
 */
export function buildCodexHookEntry(event: HookEventName, options: HookInstallOptions): HookEntry {
  const url = shellQuote(`http://127.0.0.1:${options.port}/hooks/${event}`)
  const post = `-X POST -H 'content-type: application/json' ${curlHeaders(options.secret)} --data-binary @- ${url}`
  if (event === 'PermissionRequest') {
    return {
      type: 'command',
      command: `curl -s -m ${options.permissionTimeoutSec} ${post} 2>/dev/null || true`,
      timeout: options.permissionTimeoutSec + 10,
    }
  }
  const ending = event === 'SessionEnd'
  return {
    type: 'command',
    command: `curl -s -m ${ending ? 2 : 5} -o /dev/null ${post} >/dev/null 2>&1 || true`,
    timeout: ending ? 3 : 10,
  }
}

/**
 * Gemini CLI runs command hooks only, in the shell with its environment (`$TMUX_PANE` and the
 * launcher's profile are set), with timeouts in milliseconds. None of its hooks can answer an
 * approval, so every output is discarded and the hook returns at once.
 */
export function buildGeminiHookEntry(event: HookEventName, options: HookInstallOptions): HookEntry {
  return {
    type: 'command',
    command: postCommand(event, options),
    timeout: event === 'SessionEnd' ? 3_000 : 10_000,
  }
}

/**
 * A shell command posting the hook's stdin to the daemon and discarding the answer (agents whose
 * hooks cannot answer an approval: Gemini CLI, Kimi CLI). `SessionEnd` gives up after 2 seconds.
 */
export function postCommand(event: HookEventName, options: HookInstallOptions): string {
  const url = shellQuote(`http://127.0.0.1:${options.port}/hooks/${event}`)
  const seconds = event === 'SessionEnd' ? 2 : 5
  return `curl -s -m ${seconds} -o /dev/null -X POST -H 'content-type: application/json' ${curlHeaders(options.secret)} --data-binary @- ${url} >/dev/null 2>&1 || true`
}

export function buildHookEntry(event: HookEventName, options: HookInstallOptions): HookEntry {
  const url = `http://127.0.0.1:${options.port}/hooks/${event}`
  if (COMMAND_ONLY_EVENTS.has(event)) {
    // Same request as the http hook: stdin JSON as body. Output is discarded because a
    // SessionStart hook's stdout is added to Claude's context; failures never block the session.
    const headers = curlHeaders(options.secret)
    return {
      type: 'command',
      command: `curl -s -m 5 -o /dev/null -X POST -H 'content-type: application/json' ${headers} --data-binary @- ${shellQuote(url)} >/dev/null 2>&1 || true`,
      timeout: 10,
    }
  }
  return {
    type: 'http',
    url,
    timeout: event === 'PermissionRequest' ? options.permissionTimeoutSec : 5,
    headers: {
      [SECRET_HEADER]: options.secret,
      [PANE_HEADER]: '$TMUX_PANE',
      [PROFILE_HEADER]: '$CLAUDE_REMOTE_PROFILE',
    },
    allowedEnvVars: ['TMUX_PANE', 'CLAUDE_REMOTE_PROFILE'],
  }
}

/** Removes our hooks, dropping groups and events that become empty. Never touches user hooks. */
export function removeOurHooks<T extends Settings>(settings: T): T {
  const hooks = settings.hooks
  if (!hooks || typeof hooks !== 'object') return settings
  const next: Record<string, HookGroup[]> = {}
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) {
      next[event] = groups
      continue
    }
    const kept = groups
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((h) => !isOurHook(h)) }))
      .filter((group) => group.hooks.length > 0)
    if (kept.length > 0) next[event] = kept
  }
  const result: Settings = { ...settings }
  if (Object.keys(next).length > 0) result.hooks = next
  else delete result.hooks
  return result as T
}

/** Idempotently installs our hooks next to whatever the user already has. */
export function mergeOurHooks<T extends Settings>(
  settings: T,
  options: HookInstallOptions,
  style: HookStyle = 'claude-settings',
): T & { hooks: Record<string, HookGroup[]> } {
  const clean = removeOurHooks(settings)
  const hooks: Record<string, HookGroup[]> = { ...(clean.hooks ?? {}) }
  // Qwen Code runs command hooks like Codex's: the permission hook prints the daemon's answer.
  const build =
    style === 'codex-hooks' || style === 'qwen-settings'
      ? buildCodexHookEntry
      : style === 'gemini-hooks'
        ? buildGeminiHookEntry
        : buildHookEntry
  for (const [key, event] of hookEventsFor(style)) {
    hooks[key] = [...(hooks[key] ?? []), { hooks: [build(event, options)] }]
  }
  return { ...clean, hooks }
}
