import type {
  LiveLabels,
  LiveProgress,
  LiveState,
  LiveStatusProps,
  Session,
  TranscriptEntry,
} from '@remote-harness/protocol'
import { LIVE_TASK_MAX } from '@remote-harness/protocol'
import type { Messages } from '../../core/i18n/index.ts'
import { agentWorkInFlight } from '../sessions/state.ts'
import { type ActivityKind, activityKind } from './activity.ts'

export type LiveStep = keyof Messages['live']['steps']

/** One line of the latest steps: a category, the tool behind it and how many times in a row. */
export type RecentStep = { step: LiveStep; tool: string | null; count: number }

/** The tool permission the session waits for: only its id and the tool name, never the input. */
export type LivePendingRequest = { requestId: string; tool: string }

/** The step running now: the tool and its sanitized target (see `stepTarget`), never the input. */
export type CurrentStep = { tool: string; target: string | null }

/** Tasks running in parallel in the session. */
export type TaskCounts = { subagents: number; background: number }

/**
 * The session's todo list as counts: from the latest `TodoWrite` snapshot, or built up from
 * `TaskCreate` / `TaskUpdate` calls (`completed` keeps the task ids already counted as done). `active`
 * is the in-progress item's present-tense form (sent only when the user opted in); `forms` the forms
 * of the created tasks in creation order (task id `n` is `forms[n - 1]`).
 */
export type TodoProgress = {
  done: number
  total: number
  completed: string[]
  active: string | null
  /** Task id of `active` when it came from `TaskUpdate`. */
  activeId: string | null
  forms: string[]
}

/** Live status of one registered session. Only categories and counts: never session content. */
export type LiveStatus = {
  state: LiveState
  step: LiveStep | null
  toolCount: number
  /** Start of the current turn, epoch milliseconds. */
  startedAt: number
  /** Last state change, epoch milliseconds. */
  changedAt: number
  /** End of the turn (done or closed), epoch milliseconds. */
  endedAt: number | null
  /** Latest steps, newest first. */
  recent: RecentStep[]
  /** Last step categories, newest first (the glyph row). */
  glyphs: LiveStep[]
  /** Tool permission waiting for an answer, answerable from the lock screen. */
  pending: LivePendingRequest | null
  /** Tasks running in parallel in the session (background tasks and running subagents). */
  tasks: TaskCounts
  /** The step running now, `null` while thinking, writing or between turns. */
  current: CurrentStep | null
  /** The session's todo list, `null` without one. */
  todo: TodoProgress | null
  /** What the session is doing (a key of the fixed phrase table), `null` before the first step. */
  activity: ActivityKind | null
}

export type LiveEvent =
  | { type: 'prompt' }
  | { type: 'step'; step: LiveStep; tool: string | null; target?: string | null; activity?: ActivityKind }
  /** A todo list change: a full snapshot (`TodoWrite`), a new task or a task's new status. */
  | { type: 'todo'; change: TodoChange }
  /** `pending: null` drops the lock-screen answer (the request moved to the terminal). */
  | { type: 'waiting'; permission: boolean; pending?: LivePendingRequest | null }
  | { type: 'resumed' }
  | { type: 'stop' }
  | { type: 'end' }
  | { type: 'tasks'; counts: TaskCounts }

/**
 * The live status event of a `Stop`: none while agents still work in the background (a workflow
 * run, a background subagent), so the status stays working until a later `Stop` without them.
 */
export function stopEvent(backgroundTasks: unknown): LiveEvent | null {
  return agentWorkInFlight(backgroundTasks) ? null : { type: 'stop' }
}

export type TodoChange =
  | { kind: 'snapshot'; done: number; total: number; active?: string | null }
  | { kind: 'created'; form?: string | null }
  | {
      kind: 'updated'
      taskId: string
      status: 'completed' | 'deleted' | 'in_progress' | 'open'
      form?: string | null
    }

/** Step-only changes are sent at most this often (state changes go out at once). */
export const STEP_INTERVAL_MS = 15_000
/** The activity looks stale after this long without an update. */
export const STALE_AFTER_MS = 30 * 60_000
/** A finished turn stays on the lock screen this long, and a new turn in that window reuses it. */
export const DONE_DISMISS_MS = 15 * 60_000
/** Lines of latest steps kept. */
export const RECENT_STEPS = 3
/** Glyphs of latest steps kept. */
export const RECENT_GLYPHS = 5

const TOOL_STEPS: Record<string, LiveStep> = {
  Bash: 'command',
  BashOutput: 'command',
  Edit: 'editing',
  MultiEdit: 'editing',
  Write: 'editing',
  NotebookEdit: 'editing',
  Read: 'reading',
  Grep: 'searching',
  Glob: 'searching',
  LS: 'searching',
  WebFetch: 'web',
  WebSearch: 'web',
  Task: 'agent',
  Agent: 'agent',
  TodoWrite: 'planning',
}

/** One glyph per step category, drawn by the widget's recent row. */
export const GLYPHS: Record<LiveStep, string> = {
  command: '⌘',
  editing: '✎',
  reading: '⌕',
  searching: '⌕',
  web: '⇄',
  agent: '⌥',
  permission: '?',
  thinking: '·',
  writing: '·',
  planning: '·',
  tool: '·',
}

/** Fixed category for a tool name; the tool's input and output never leave the daemon. */
export function toolStep(name: string): LiveStep {
  return TOOL_STEPS[name] ?? 'tool'
}

/** Longest target shown after the tool name. */
export const TARGET_MAX = 40

const FILE_TOOLS = new Set(['Read', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
/** Programs whose next word is a subcommand worth showing (`pnpm test`, `git push`). */
const SUBCOMMAND_PROGRAMS = new Set([
  'git',
  'pnpm',
  'npm',
  'yarn',
  'bun',
  'npx',
  'pnpx',
  'bunx',
  'cargo',
  'go',
  'make',
  'docker',
  'gh',
  'kubectl',
  'turbo',
  'uv',
  'pip',
  'brew',
])
/** Words that run the next one (`sudo make`, `env FOO=1 pnpm`). */
const WRAPPERS = new Set(['sudo', 'env', 'time', 'nohup', 'exec', 'command'])
const PLAIN_WORD = /^[a-z][a-z0-9._-]{0,23}$/
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/

function clip(text: string): string {
  return text.length > TARGET_MAX ? `${text.slice(0, TARGET_MAX - 1)}…` : text
}

function baseName(path: string): string {
  return (
    path
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .at(-1) ?? ''
  )
}

/** `pnpm test` from `cd app && FOO=1 pnpm test --filter x`: the program and maybe its subcommand. */
function commandTarget(command: string): string | null {
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean)
    let index = 0
    while (WRAPPERS.has(words[index] ?? '') || /^\w+=/.test(words[index] ?? '')) index++
    const program = words[index]
    if (!program || program === 'cd') continue
    // A quoted or expanded program (`"./my script.sh"`, `$(…)`) is not shown.
    if (!/^[\w.+~/\\-]+$/.test(program)) return null
    const name = baseName(program)
    if (!name) return null
    const next = words[index + 1]
    return next && SUBCOMMAND_PROGRAMS.has(name) && PLAIN_WORD.test(next) ? `${name} ${next}` : name
  }
  return null
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname || null
  } catch {
    return null
  }
}

/**
 * A short target for a tool call, from a fixed table: a file's base name, a command's program (with
 * its subcommand for a few programs), a URL's host name, a subagent type. Nothing else of the input
 * (command arguments, directories, patterns, queries) ever leaves the daemon.
 */
export function stepTarget(name: string, input: Readonly<Record<string, unknown>>): string | null {
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
  let target: string | null = null
  if (FILE_TOOLS.has(name)) {
    const path = text(input.file_path) ?? text(input.notebook_path)
    target = path ? baseName(path) || null : null
  } else if (name === 'Bash') {
    const command = text(input.command)
    target = command ? commandTarget(command) : null
  } else if (name === 'WebFetch') {
    const url = text(input.url)
    target = url ? hostOf(url) : null
  } else if (name === 'Task' || name === 'Agent') {
    const type = text(input.subagent_type)
    target = type && IDENTIFIER.test(type) ? type : null
  }
  return target ? clip(target) : null
}

/** A todo item's text on one line, clipped to LIVE_TASK_MAX; `null` when empty. */
export function taskText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return null
  return clean.length > LIVE_TASK_MAX ? `${clean.slice(0, LIVE_TASK_MAX - 1)}…` : clean
}

/** The present-tense form of a todo item (`activeForm`), else its text. */
function formOf(item: Readonly<Record<string, unknown>>): string | null {
  return taskText(item.activeForm) ?? taskText(item.content) ?? taskText(item.subject)
}

/** The todo list change a tool call stands for (`TodoWrite`, `TaskCreate`, `TaskUpdate`), if any. */
export function todoChange(name: string, input: Readonly<Record<string, unknown>>): TodoChange | null {
  switch (name) {
    case 'TodoWrite': {
      if (!Array.isArray(input.todos)) return null
      const items = input.todos.filter(
        (todo): todo is Record<string, unknown> => !!todo && typeof todo === 'object',
      )
      const active = items.find((todo) => todo.status === 'in_progress')
      return {
        kind: 'snapshot',
        done: items.filter((todo) => todo.status === 'completed').length,
        total: items.length,
        active: active ? formOf(active) : null,
      }
    }
    case 'TaskCreate':
      return { kind: 'created', form: formOf(input) }
    case 'TaskUpdate': {
      const taskId = input.taskId ?? input.task_id ?? input.id
      if ((typeof taskId !== 'string' && typeof taskId !== 'number') || typeof input.status !== 'string')
        return null
      const status =
        input.status === 'completed' || input.status === 'deleted' || input.status === 'in_progress'
          ? input.status
          : 'open'
      return { kind: 'updated', taskId: String(taskId), status, form: taskText(input.activeForm) }
    }
    default:
      return null
  }
}

/** The todo list after a change; an update without a known list changes nothing. */
export function applyTodo(todo: TodoProgress | null, change: TodoChange): TodoProgress | null {
  switch (change.kind) {
    case 'snapshot':
      return change.total > 0
        ? {
            done: change.done,
            total: change.total,
            completed: [],
            active: change.active ?? null,
            activeId: null,
            forms: [],
          }
        : null
    case 'created': {
      const current = todo ?? { done: 0, total: 0, completed: [], active: null, activeId: null, forms: [] }
      return { ...current, total: current.total + 1, forms: [...current.forms, change.form ?? ''] }
    }
    case 'updated': {
      if (!todo || todo.total === 0) return todo
      const form = change.form ?? (todo.forms[Number(change.taskId) - 1] || null)
      // The task in progress becomes the current one; finishing or deleting it clears it.
      const ended =
        change.status !== 'in_progress' && change.status !== 'open' && change.taskId === todo.activeId
      const current =
        change.status === 'in_progress'
          ? { active: form ?? todo.active, activeId: change.taskId }
          : ended
            ? { active: null, activeId: null }
            : { active: todo.active, activeId: todo.activeId }
      const { active } = current
      const wasDone = todo.completed.includes(change.taskId)
      if (change.status === 'completed') {
        return wasDone
          ? { ...todo, ...current }
          : { ...todo, ...current, done: todo.done + 1, completed: [...todo.completed, change.taskId] }
      }
      const completed = wasDone ? todo.completed.filter((id) => id !== change.taskId) : todo.completed
      const done = wasDone ? todo.done - 1 : todo.done
      if (change.status === 'deleted') {
        const total = todo.total - 1
        return total > 0 ? { ...todo, ...current, done, total, completed } : null
      }
      return wasDone || active !== todo.active ? { ...todo, ...current, done, completed } : todo
    }
  }
}

/** The todo list as the props show it: `null` without one, `done` never past `total`. */
export function todoProgress(todo: TodoProgress | null): LiveProgress | null {
  if (!todo || todo.total <= 0) return null
  return { done: Math.max(0, Math.min(todo.done, todo.total)), total: todo.total }
}

/** The events a transcript entry stands for: its step, then its todo list change when it has one. */
export function eventsForEntry(entry: TranscriptEntry): LiveEvent[] {
  const step = stepForEntry(entry)
  if (!step) return []
  if (entry.kind !== 'tool_use') return [step]
  const change = todoChange(entry.name, entry.input)
  return change ? [step, { type: 'todo', change }] : [step]
}

/** The step event a transcript entry stands for, if any. */
export function stepForEntry(entry: TranscriptEntry): LiveEvent | null {
  if (entry.isSidechain) return null
  switch (entry.kind) {
    case 'tool_use':
      return {
        type: 'step',
        step: toolStep(entry.name),
        tool: entry.name,
        target: stepTarget(entry.name, entry.input),
        activity: activityKind(entry.name, entry.input),
      }
    case 'thinking':
      return { type: 'step', step: 'thinking', tool: null, activity: 'thinking' }
    case 'assistant_text':
      return { type: 'step', step: 'writing', tool: null, activity: 'writing' }
    default:
      return null
  }
}

const NO_TASKS: TaskCounts = { subagents: 0, background: 0 }

export function initialLiveStatus(
  at: number,
  tasks: TaskCounts = NO_TASKS,
  todo: TodoProgress | null = null,
): LiveStatus {
  return {
    state: 'working',
    step: null,
    toolCount: 0,
    startedAt: at,
    changedAt: at,
    endedAt: null,
    recent: [],
    glyphs: [],
    pending: null,
    tasks,
    current: null,
    todo,
    activity: null,
  }
}

/** Tasks a session runs in parallel: its running subagents and its background tasks. */
export function taskCounts(session: Pick<Session, 'backgroundTasks' | 'subagents'>): TaskCounts {
  return {
    subagents: session.subagents.filter((s) => s.state === 'running').length,
    background: session.backgroundTasks,
  }
}

export function sameTaskCounts(a: TaskCounts, b: TaskCounts): boolean {
  return a.subagents === b.subagents && a.background === b.background
}

/** A todo list carries over to the next turn only while unfinished. */
function carriedTodo(todo: TodoProgress | null): TodoProgress | null {
  return todo && todo.done < todo.total ? todo : null
}

/** Adds a step to the latest ones, merging it with the newest when it repeats. */
export function pushRecent(recent: readonly RecentStep[], step: LiveStep, tool: string | null): RecentStep[] {
  const [newest, ...older] = recent
  if (newest && newest.step === step && newest.tool === tool) {
    return [{ ...newest, count: newest.count + 1 }, ...older]
  }
  return [{ step, tool, count: 1 }, ...recent].slice(0, RECENT_STEPS)
}

/** Adds a step to the glyph row (repeats kept: the row reads as a timeline). */
export function pushGlyph(glyphs: readonly LiveStep[], step: LiveStep): LiveStep[] {
  return [step, ...glyphs].slice(0, RECENT_GLYPHS)
}

/** `status` in `state`, stamping the change time only when the state actually changes. */
function withState(status: LiveStatus, state: LiveState, now: number): LiveStatus {
  return status.state === state ? status : { ...status, state, changedAt: now }
}

/**
 * Next status after an event at `now`. A finished status only changes with a new prompt, a task
 * count (background tasks outlive the turn) or the session closing; a closed one never does.
 */
export function reduceLiveStatus(status: LiveStatus, event: LiveEvent, now: number): LiveStatus {
  if (event.type === 'prompt') return initialLiveStatus(now, status.tasks, carriedTodo(status.todo))
  if (status.state === 'closed') return status
  if (event.type === 'tasks') {
    return sameTaskCounts(status.tasks, event.counts) ? status : { ...status, tasks: event.counts }
  }
  if (status.state === 'done' && event.type !== 'end') return status
  switch (event.type) {
    case 'todo':
      return { ...status, todo: applyTodo(status.todo, event.change) }
    case 'step':
      return {
        ...withState(status, 'working', now),
        step: event.step,
        current: event.tool ? { tool: event.tool, target: event.target ?? null } : null,
        activity: event.activity ?? status.activity,
        toolCount: status.toolCount + (event.tool ? 1 : 0),
        recent: pushRecent(status.recent, event.step, event.tool),
        glyphs: pushGlyph(status.glyphs, event.step),
      }
    case 'waiting': {
      const waiting = withState(status, 'waiting', now)
      if (!event.permission) return waiting
      return {
        ...waiting,
        step: 'permission',
        pending: event.pending === undefined ? status.pending : event.pending,
        // The permission shows once in the row, however many times the daemon hears about it.
        glyphs: status.glyphs[0] === 'permission' ? status.glyphs : pushGlyph(status.glyphs, 'permission'),
      }
    }
    case 'resumed':
      return status.state === 'waiting'
        ? { ...withState(status, 'working', now), step: null, pending: null }
        : status
    case 'stop':
      return { ...withState(status, 'done', now), step: null, current: null, endedAt: now, pending: null }
    case 'end':
      return { ...withState(status, 'closed', now), step: null, current: null, endedAt: now, pending: null }
  }
}

/** Whether the status ends the activity at once (closed). A done one ends after DONE_DISMISS_MS. */
export function isFinal(status: LiveStatus): boolean {
  return status.state === 'closed'
}

/**
 * When to send `next`: `now` for a state or pending change (or the first send), `later` (after the
 * delay) for a step-only change inside the throttle window, `never` when nothing visible changed.
 */
export function planSend(
  previous: LiveStatus | null,
  next: LiveStatus,
  lastSentAt: number | null,
  now: number,
): { when: 'now' } | { when: 'later'; delayMs: number } | { when: 'never' } {
  if (
    !previous ||
    lastSentAt === null ||
    previous.state !== next.state ||
    previous.startedAt !== next.startedAt ||
    previous.pending?.requestId !== next.pending?.requestId
  ) {
    return { when: 'now' }
  }
  if (
    previous.step === next.step &&
    previous.toolCount === next.toolCount &&
    previous.recent === next.recent &&
    previous.current === next.current &&
    previous.todo === next.todo &&
    sameTaskCounts(previous.tasks, next.tasks)
  ) {
    return { when: 'never' }
  }
  const elapsed = now - lastSentAt
  return elapsed >= STEP_INTERVAL_MS
    ? { when: 'now' }
    : { when: 'later', delayMs: STEP_INTERVAL_MS - elapsed }
}

/** What the live status shows about the session besides its status. */
export type LiveSessionInfo = {
  /** Profile name. */
  title: string
  host: string
  session: string
  path: string
  /** Deep link that opens the session. */
  link?: string
}

/** How one registration wants its props: the opt-in task and when the update goes out. */
export type LivePropsOptions = { showTask?: boolean; notifiedAt?: number }

/** The translated phrase of what the session is doing: "Finished" once done, none when closed. */
export function activityText(status: LiveStatus, messages: Messages['live']): string {
  if (status.state === 'done') return messages.activities.finished
  if (status.state === 'closed' || !status.activity) return ''
  if (status.activity === 'delegating')
    return messages.activities.delegating(Math.max(1, status.tasks.subagents))
  return messages.activities[status.activity]
}

/** The opted-in current task, only while the turn runs or waits. */
export function taskLine(status: LiveStatus, showTask: boolean): string {
  if (!showTask || (status.state !== 'working' && status.state !== 'waiting')) return ''
  return status.todo?.active ?? ''
}

function labelsOf(messages: Messages['live']): LiveLabels {
  return { ...messages.labels, total: messages.total }
}

/** Short tool name: MCP tools (`mcp__server__tool`) keep only the tool. */
function shortTool(name: string): string {
  return name.startsWith('mcp__') ? (name.split('__').at(-1) ?? name) : name
}

/** One translated line of the latest steps: "Bash · running a command ×2". */
export function recentLine(recent: RecentStep, messages: Messages['live']): string {
  const step = messages.steps[recent.step]
  const text = recent.tool
    ? `${shortTool(recent.tool)} · ${step}`
    : step.charAt(0).toUpperCase() + step.slice(1)
  return recent.count > 1 ? `${text} ×${recent.count}` : text
}

/** The current step as one line: "Bash · pnpm test", or the tool alone without a target. */
export function currentLine(current: CurrentStep | null): string {
  if (!current) return ''
  const tool = shortTool(current.tool)
  return current.target ? `${tool} · ${current.target}` : tool
}

/** The translated counts of tasks in parallel: "2 subagents · 1 background task", empty when none. */
export function tasksLine(tasks: TaskCounts, messages: Messages['live']): string {
  return [
    tasks.subagents > 0 ? messages.subagents(tasks.subagents) : '',
    tasks.background > 0 ? messages.background(tasks.background) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Props shown by the widget and the Android notification, in the daemon's language. */
export function liveProps(
  status: LiveStatus,
  info: LiveSessionInfo,
  messages: Messages['live'],
  options: LivePropsOptions = {},
): LiveStatusProps {
  return {
    title: info.title,
    state: status.state,
    status: messages.states[status.state],
    step: status.step ? messages.steps[status.step] : '',
    tools: status.toolCount > 0 ? messages.tools(status.toolCount) : '',
    startedAt: status.startedAt,
    host: info.host,
    session: info.session,
    path: info.path,
    recent: status.recent.map((recent) => recentLine(recent, messages)),
    ago: messages.ago,
    changedAt: status.changedAt,
    endedAt: status.endedAt,
    glyphs: status.glyphs.map((step) => GLYPHS[step]),
    pending: status.pending
      ? {
          ...status.pending,
          tool: shortTool(status.pending.tool),
          allow: messages.allow,
          deny: messages.deny,
        }
      : null,
    hint: status.state === 'done' ? messages.total : status.state === 'closed' ? messages.closedHint : '',
    tasks: tasksLine(status.tasks, messages),
    current: currentLine(status.current),
    progress: todoProgress(status.todo),
    activity: activityText(status, messages),
    task: taskLine(status, options.showTask ?? false),
    notifiedAt: options.notifiedAt ?? 0,
    link: info.link ?? '',
    labels: labelsOf(messages),
  }
}
