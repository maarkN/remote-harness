import type { Session } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'
import { sessionAgent } from './agent'

export type ListSummary = {
  sessions: number
  running: number
  waiting: number
  /** Background tasks and running subagents across every session in the list. */
  tasks: number
  /** Distinct agents among the sessions. */
  agents: number
  /** Of those agents, how many have at least one running session. */
  agentsRunning: number
}

/** Numbers of the machine line: sessions (total, running, waiting, tasks) and agents (total, running). */
export function listSummary(sessions: readonly Session[]): ListSummary {
  const agents = new Set<string>()
  const agentsRunning = new Set<string>()
  let running = 0
  let waiting = 0
  let tasks = 0
  for (const session of sessions) {
    const agent = sessionAgent(session)
    if (agent) agents.add(agent)
    if (session.state === 'running') {
      running++
      if (agent) agentsRunning.add(agent)
    } else if (session.state === 'waiting') {
      waiting++
    }
    tasks += session.backgroundTasks + session.subagents.filter((s) => s.state === 'running').length
  }
  return {
    sessions: sessions.length,
    running,
    waiting,
    tasks,
    agents: agents.size,
    agentsRunning: agentsRunning.size,
  }
}

/**
 * The machine line's second line: background tasks, then the distinct agents and how many are
 * running (#555); null when there is neither.
 */
export function statsLine(summary: ListSummary, t: TFunction): string | null {
  const parts: string[] = []
  if (summary.tasks > 0) parts.push(t('sessions.tasksCount', { count: summary.tasks }))
  if (summary.agents > 0) {
    parts.push(t('sessions.agents', { count: summary.agents }))
    if (summary.agentsRunning > 0) parts.push(t('sessions.runningCount', { count: summary.agentsRunning }))
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Sessions in an isolated copy: Claude Code's `--worktree` and the app's toggle create them under `.claude/worktrees`. */
export function isWorktreePath(cwd: string): boolean {
  return /(^|\/)\.claude\/worktrees\//.test(`${cwd}/`)
}
