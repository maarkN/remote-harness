import type { SubagentInfo } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import {
  phaseRows,
  phaseState,
  workflowAgents,
  workflowDescription,
  workflowStatus,
  workflowSummary,
  workflowTitle,
} from './logic'

const en = createI18n('en-US').t
const pt = createI18n('pt-BR').t

function agent(
  agentId: string,
  patch: Partial<SubagentInfo> & { phase?: string; run?: string } = {},
): SubagentInfo {
  const { phase, run = 'wf_1', ...rest } = patch
  return {
    agentId,
    agentType: 'workflow-subagent',
    description: agentId,
    state: 'running',
    updatedAt: '2026-10-30T10:00:00.000Z',
    startedAt: '2026-10-30T10:00:00.000Z',
    toolCount: 0,
    workflowRunId: run,
    ...(phase ? { workflowPhase: phase } : {}),
    ...rest,
  }
}

describe('workflowStatus', () => {
  test('starting, running, then the notification decides', () => {
    expect(workflowStatus(false, undefined)).toBe('starting')
    expect(workflowStatus(true, undefined)).toBe('running')
    expect(workflowStatus(true, 'completed')).toBe('done')
    expect(workflowStatus(true, 'failed')).toBe('failed')
    expect(workflowStatus(true, 'stopped')).toBe('stopped')
    expect(workflowStatus(true, 'killed')).toBe('stopped')
    expect(workflowStatus(true, 'cancelled')).toBe('stopped')
  })
})

describe('workflowAgents', () => {
  test('keeps the agents of the run only, none before the run id is known', () => {
    const all = [agent('a'), agent('b', { run: 'wf_2' }), { ...agent('c'), workflowRunId: undefined }]
    expect(workflowAgents(all, 'wf_1').map((a) => a.agentId)).toEqual(['a'])
    expect(workflowAgents(all, null)).toEqual([])
  })
})

describe('phaseRows', () => {
  const phases = [
    { title: 'Review', detail: null },
    { title: 'Verify', detail: 'one agent per finding' },
  ]

  test('counts agents per declared phase, in the script order', () => {
    const agents = [
      agent('a', { phase: 'Review', state: 'done' }),
      agent('b', { phase: 'Review' }),
      agent('c', { phase: 'Verify', state: 'done', outcome: 'failed' }),
    ]
    expect(phaseRows(phases, agents)).toEqual([
      { title: 'Review', detail: null, total: 2, done: 1, running: 1, failed: 0 },
      { title: 'Verify', detail: 'one agent per finding', total: 1, done: 1, running: 0, failed: 1 },
    ])
  })

  test('undeclared phases get rows after the declared ones; agents without a phase count nowhere', () => {
    const agents = [agent('x', { phase: 'Cleanup' }), agent('y'), agent('z', { phase: 'Review' })]
    expect(phaseRows(phases, agents).map((r) => [r.title, r.total])).toEqual([
      ['Review', 1],
      ['Verify', 0],
      ['Cleanup', 1],
    ])
    expect(phaseRows([], agents).map((r) => r.title)).toEqual(['Cleanup', 'Review'])
  })

  test('phase state', () => {
    expect(phaseState({ total: 0, running: 0, failed: 0 })).toBe('pending')
    expect(phaseState({ total: 2, running: 1, failed: 0 })).toBe('active')
    expect(phaseState({ total: 2, running: 0, failed: 0 })).toBe('done')
    expect(phaseState({ total: 2, running: 0, failed: 1 })).toBe('failed')
  })
})

describe('card texts', () => {
  const call = { name: 'review-changes', description: 'Review the diff', phases: [] }

  test('title and description fall back to "Workflow" and the launch summary', () => {
    expect(workflowTitle(call, en)).toBe('review-changes')
    expect(workflowTitle({ ...call, name: null }, en)).toBe('Workflow')
    expect(workflowTitle({ ...call, name: ' ' }, pt)).toBe('Workflow')
    expect(workflowDescription(call, null)).toBe('Review the diff')
    expect(
      workflowDescription({ ...call, description: null }, { taskId: 'w', runId: 'wf', summary: 'Echoed' }),
    ).toBe('Echoed')
    expect(workflowDescription({ ...call, description: null }, null)).toBeNull()
  })

  test('summary line counts phases, agents and running ones, in the app language', () => {
    const rows = phaseRows(
      [
        { title: 'A', detail: null },
        { title: 'B', detail: null },
      ],
      [],
    )
    const agents = [agent('a'), agent('b', { state: 'done' }), agent('c', { state: 'done' })]
    expect(workflowSummary(rows, agents, en)).toBe('2 phases · 3 agents · 1 running')
    expect(workflowSummary([], [agent('a', { state: 'done' })], en)).toBe('1 agent')
    expect(workflowSummary(rows, agents, pt)).toBe('2 fases · 3 agentes · 1 rodando')
  })
})
