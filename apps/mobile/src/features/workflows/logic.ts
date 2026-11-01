import type { SubagentInfo, WorkflowCall, WorkflowLaunch, WorkflowPhase } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'
import { subagentStatus } from '@/features/subagents/sort'

/** Where a workflow run stands, as the card badges it. */
export type WorkflowStatus = 'starting' | 'running' | 'done' | 'failed' | 'stopped'

/**
 * `starting` until the launch result is written, `running` after it, and from the run's task
 * notification `done` (`completed`), `failed` (`failed`) or `stopped` (anything else).
 */
export function workflowStatus(launched: boolean, notificationStatus: string | undefined): WorkflowStatus {
  if (notificationStatus !== undefined) {
    if (notificationStatus === 'completed') return 'done'
    return notificationStatus === 'failed' ? 'failed' : 'stopped'
  }
  return launched ? 'running' : 'starting'
}

/** Badge tone per status (theme tokens), the subagent tones with `starting` as running. */
export const WORKFLOW_TONES = {
  starting: 'accent',
  running: 'accent',
  done: 'success',
  failed: 'danger',
  stopped: 'warning',
} as const satisfies Record<WorkflowStatus, string>

/** The run's agents: the session's subagents carrying its run id (none until the launch result names it). */
export function workflowAgents(subagents: readonly SubagentInfo[], runId: string | null): SubagentInfo[] {
  return runId ? subagents.filter((s) => s.workflowRunId === runId) : []
}

export type PhaseRow = {
  title: string
  detail: string | null
  /** Agents seen in the phase so far. */
  total: number
  /** Agents that ended (whatever the outcome). */
  done: number
  running: number
  failed: number
}

/**
 * The phases in the script's order with their agents' counts; agents in a phase the script did not
 * declare (or every agent, when the script declared none) get rows of their own, after the declared
 * ones, in order of appearance. An agent without a phase is counted nowhere.
 */
export function phaseRows(phases: readonly WorkflowPhase[], agents: readonly SubagentInfo[]): PhaseRow[] {
  const rows: PhaseRow[] = phases.map((p) => ({
    title: p.title,
    detail: p.detail,
    total: 0,
    done: 0,
    running: 0,
    failed: 0,
  }))
  const byTitle = new Map(rows.map((row) => [row.title, row]))
  for (const agent of agents) {
    const title = agent.workflowPhase
    if (!title) continue
    let row = byTitle.get(title)
    if (!row) {
      row = { title, detail: null, total: 0, done: 0, running: 0, failed: 0 }
      byTitle.set(title, row)
      rows.push(row)
    }
    row.total++
    const status = subagentStatus(agent)
    if (status === 'running') row.running++
    else {
      row.done++
      if (status === 'failed') row.failed++
    }
  }
  return rows
}

export type PhaseState = 'pending' | 'active' | 'done' | 'failed'

/** Pending without agents, active while any runs, then done or failed (when any agent failed). */
export function phaseState(row: Pick<PhaseRow, 'total' | 'running' | 'failed'>): PhaseState {
  if (row.total === 0) return 'pending'
  if (row.running > 0) return 'active'
  return row.failed > 0 ? 'failed' : 'done'
}

/** Glyph before a phase's title, in the terminal style of the todo list. */
export const PHASE_GLYPHS: Record<PhaseState, string> = { pending: '○', active: '◐', done: '✓', failed: '×' }

/** The card's title: the declared name, else "Workflow". */
export function workflowTitle(call: WorkflowCall, t: TFunction): string {
  return call.name?.trim() || t('workflow.title')
}

/** The card's description: the declared one, else what the launch echoed; null when neither. */
export function workflowDescription(call: WorkflowCall, launch: WorkflowLaunch | null): string | null {
  return call.description?.trim() || launch?.summary?.trim() || null
}

/** "2 phases · 3 agents · 1 running": the collapsed card's line; empty before anything is known. */
export function workflowSummary(
  rows: readonly PhaseRow[],
  agents: readonly SubagentInfo[],
  t: TFunction,
): string {
  const running = agents.filter((a) => a.state === 'running').length
  return [
    rows.length > 0 ? t('workflow.phases', { count: rows.length }) : null,
    t('workflow.agents', { count: agents.length }),
    running > 0 ? t('workflow.running', { count: running }) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
