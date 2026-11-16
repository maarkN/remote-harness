import type { SubagentInfo } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import {
  cardSubagents,
  sortSubagents,
  subagentCounts,
  subagentElapsed,
  subagentKind,
  subagentLabel,
  subagentStateCounts,
  subagentStatus,
} from './sort'

const en = createI18n('en-US').t

const sub = (agentId: string, state: SubagentInfo['state'], updatedAt: string): SubagentInfo => ({
  agentId,
  agentType: null,
  description: null,
  state,
  updatedAt,
  startedAt: null,
  toolCount: 0,
})

describe('subagents', () => {
  test('running first, newest first', () => {
    const list = [sub('a', 'done', '3'), sub('b', 'running', '1'), sub('c', 'running', '2')]
    expect(sortSubagents(list).map((s) => s.agentId)).toEqual(['c', 'b', 'a'])
  })

  test('label: description, then type, then "Subagent #N" by start, never blank', () => {
    const first = { ...sub('a1', 'done', '5'), startedAt: '1' }
    const second = { ...sub('b2', 'done', '4'), startedAt: '2', description: '  ' }
    const all = [second, first]
    expect(subagentLabel({ ...first, description: 'Buscar' }, all, en)).toBe('Buscar')
    expect(subagentLabel({ ...first, description: '', agentType: ' Explore ' }, all, en)).toBe('Explore')
    expect(subagentLabel(second, all, en)).toBe('Subagent #2')
    expect(subagentLabel(sub('abcdefghij', 'done', ''), [], en)).toBe('abcdefgh')
    expect(subagentKind({ description: 'Buscar', agentType: 'Explore' })).toBe('Explore')
    expect(subagentKind({ description: null, agentType: 'Explore' })).toBeNull()
  })

  test('status: running, or how it ended', () => {
    expect(subagentStatus({ state: 'running' })).toBe('running')
    expect(subagentStatus({ state: 'done' })).toBe('done')
    expect(subagentStatus({ state: 'done', outcome: 'failed' })).toBe('failed')
    expect(subagentStatus({ state: 'done', outcome: 'stopped' })).toBe('stopped')
  })

  test('counts total and running', () => {
    expect(subagentCounts([])).toEqual({ count: 0, running: 0 })
    expect(subagentCounts([sub('a', 'done', ''), sub('b', 'running', ''), sub('c', 'running', '')])).toEqual({
      count: 3,
      running: 2,
    })
  })

  test('elapsed: live while running, total once done, unknown without a start', () => {
    const now = Date.parse('2026-10-18T12:01:12Z')
    const started = '2026-10-18T12:00:00Z'
    expect(subagentElapsed({ state: 'running', startedAt: started, updatedAt: started }, now)).toBe(72_000)
    expect(
      subagentElapsed({ state: 'done', startedAt: started, updatedAt: '2026-10-18T12:03:05Z' }, now),
    ).toBe(185_000)
    expect(subagentElapsed({ state: 'running', startedAt: null, updatedAt: started }, now)).toBeNull()
    expect(subagentElapsed({ state: 'done', startedAt: 'nope', updatedAt: started }, now)).toBeNull()
    // A clock behind the daemon never shows a negative counter.
    expect(subagentElapsed({ state: 'running', startedAt: started, updatedAt: started }, now - 100_000)).toBe(
      0,
    )
  })
})

describe('card icons (#562)', () => {
  const ended = (agentId: string, updatedAt: string, outcome?: 'failed' | 'stopped'): SubagentInfo => ({
    ...sub(agentId, 'done', updatedAt),
    ...(outcome ? { outcome } : {}),
  })

  test('at most three, running first, and the rest counted', () => {
    const list = [
      ended('a', '1'),
      sub('b', 'running', '2'),
      ended('c', '5', 'failed'),
      sub('d', 'running', '3'),
    ]
    expect(cardSubagents(list)).toEqual({
      shown: [
        { agentId: 'd', status: 'running' },
        { agentId: 'b', status: 'running' },
        { agentId: 'c', status: 'failed' },
      ],
      hidden: 1,
      hiddenRunning: 0,
    })
  })

  test('the overflow only counts the running ones it hides', () => {
    const list = [...['a', 'b', 'c', 'd', 'e'].map((id, i) => sub(id, 'running', String(i))), ended('f', '9')]
    const card = cardSubagents(list)
    expect(card.shown).toHaveLength(3)
    expect(card.hidden).toBe(3)
    expect(card.hiddenRunning).toBe(2)
  })

  test('none: nothing to show', () => {
    expect(cardSubagents([])).toEqual({ shown: [], hidden: 0, hiddenRunning: 0 })
  })

  test('counts per state, in the badge order', () => {
    const list = [sub('a', 'running', '1'), ended('b', '2'), ended('c', '3', 'failed'), ended('d', '4')]
    expect(subagentStateCounts(list)).toEqual([
      ['running', 1],
      ['done', 2],
      ['failed', 1],
    ])
  })
})
