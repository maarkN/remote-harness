import type { Question } from '@remote-harness/protocol'
import { describe, expect, it } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import type { Command } from './commands'
import {
  type Effect,
  type HandsFreeEvent,
  type HandsFreeState,
  INITIAL_STATE,
  type Item,
  step,
} from './engine'

const { t } = createI18n('en-US')

/** Runs events in order; returns the final state and every effect. */
function run(events: HandsFreeEvent[], state: HandsFreeState = INITIAL_STATE) {
  const effects: Effect[] = []
  let current = state
  for (const event of events) {
    const result = step(current, event, t)
    current = result.state
    effects.push(...result.effects)
  }
  return { state: current, effects }
}

const heard = (command: Command): HandsFreeEvent => ({ type: 'heard', command })
const permission: Item = { kind: 'permission', requestId: 'r1', say: 'Run a command. Say allow or deny.' }
const choice = (multiSelect = false): Question => ({
  question: 'Which database?',
  header: null,
  kind: 'choice',
  options: [
    { label: 'Postgres', description: null },
    { label: 'SQLite', description: null },
    { label: 'MySQL', description: null },
  ],
  multiSelect,
})
const question = (questions: Question[]): Item => ({
  kind: 'question',
  requestId: 'q1',
  questions,
  says: questions.map((q) => q.question),
  index: 0,
  answers: {},
  say: questions[0]?.question ?? '',
})
const sends = (effects: Effect[]) =>
  effects.filter((e) => e.type === 'respond' || e.type === 'answer' || e.type === 'send')
const spoken = (effects: Effect[]) => effects.flatMap((e) => (e.type === 'speak' ? [e.text] : []))

describe('permissions', () => {
  it('reads the request, listens, and denies at once with a spoken confirmation', () => {
    const { effects, state } = run([
      { type: 'enqueue', item: permission },
      { type: 'spoken' },
      heard({ kind: 'deny' }),
    ])
    expect(spoken(effects)).toEqual(['Run a command. Say allow or deny.', 'Denied.'])
    expect(effects).toContainEqual({ type: 'listen' })
    expect(sends(effects)).toEqual([{ type: 'respond', requestId: 'r1', decision: 'deny' }])
    expect(state.current).toEqual({ kind: 'notice', say: 'Denied.' })
  })

  it('never answers on a misheard word, and leaves it for the screen after two misses', () => {
    const { effects } = run([
      { type: 'enqueue', item: permission },
      { type: 'spoken' },
      heard({ kind: 'message', text: 'deni' }),
      { type: 'spoken' },
      heard({ kind: 'yes' }),
    ])
    expect(sends(effects)).toEqual([])
    expect(spoken(effects).slice(1)).toEqual([
      'I didn’t get that. Say allow or deny.',
      'Answer it on the screen.',
    ])
  })

  it('leaves the request alone on silence', () => {
    const { effects, state } = run([
      { type: 'enqueue', item: permission },
      { type: 'spoken' },
      heard({ kind: 'empty' }),
    ])
    expect(sends(effects)).toEqual([])
    expect(state.phase).toBe('idle')
  })

  it('drops a request answered elsewhere', () => {
    const { effects, state } = run([
      { type: 'enqueue', item: permission },
      { type: 'resolved', requestId: 'r1' },
    ])
    expect(effects).toContainEqual({ type: 'silence' })
    expect(state.current).toBeNull()
  })
})

describe('questions', () => {
  it('answers a single choice with the option label', () => {
    const { effects } = run([
      { type: 'enqueue', item: question([choice()]) },
      { type: 'spoken' },
      heard({ kind: 'options', numbers: [2] }),
    ])
    expect(sends(effects)).toEqual([
      { type: 'answer', requestId: 'q1', answers: { 'Which database?': 'SQLite' } },
    ])
    expect(spoken(effects).at(-1)).toBe('Answered.')
  })

  it('joins several options in option order for a multiple choice', () => {
    const { effects } = run([
      { type: 'enqueue', item: question([choice(true)]) },
      { type: 'spoken' },
      heard({ kind: 'options', numbers: [3, 1] }),
    ])
    expect(sends(effects)).toEqual([
      { type: 'answer', requestId: 'q1', answers: { 'Which database?': 'Postgres, MySQL' } },
    ])
  })

  it('refuses options out of range or several for a single choice', () => {
    const outOfRange = run([
      { type: 'enqueue', item: question([choice()]) },
      { type: 'spoken' },
      heard({ kind: 'options', numbers: [5] }),
    ])
    expect(sends(outOfRange.effects)).toEqual([])
    expect(spoken(outOfRange.effects).at(-1)).toBe('I didn’t get that. Say a number from 1 to 3.')
    const several = run([
      { type: 'enqueue', item: question([choice()]) },
      { type: 'spoken' },
      heard({ kind: 'options', numbers: [1, 2] }),
    ])
    expect(sends(several.effects)).toEqual([])
  })

  it('asks every question before answering, and takes free text for open questions', () => {
    const open: Question = {
      question: 'Any notes?',
      header: null,
      kind: 'text',
      options: [],
      multiSelect: false,
    }
    const { effects } = run([
      { type: 'enqueue', item: question([choice(), open]) },
      { type: 'spoken' },
      heard({ kind: 'options', numbers: [1] }),
      { type: 'spoken' },
      heard({ kind: 'message', text: 'keep it simple' }),
    ])
    expect(spoken(effects)).toEqual(['Which database?', 'Any notes?', 'Answered.'])
    expect(sends(effects)).toEqual([
      {
        type: 'answer',
        requestId: 'q1',
        answers: { 'Which database?': 'Postgres', 'Any notes?': 'keep it simple' },
      },
    ])
  })
})

describe('messages', () => {
  it('reads a heard message back and sends it only after yes', () => {
    const { effects } = run([
      { type: 'talk' },
      heard({ kind: 'message', text: 'run the tests' }),
      { type: 'spoken' },
      heard({ kind: 'yes' }),
    ])
    expect(spoken(effects)).toEqual(['Send: run the tests? Say yes or no.', 'Sent.'])
    expect(sends(effects)).toEqual([{ type: 'send', text: 'run the tests' }])
  })

  it('discards it on no or silence', () => {
    for (const command of [{ kind: 'no' }, { kind: 'empty' }] as Command[]) {
      const { effects } = run([
        { type: 'talk' },
        heard({ kind: 'message', text: 'rm -rf' }),
        { type: 'spoken' },
        heard(command),
      ])
      expect(sends(effects)).toEqual([])
      expect(spoken(effects).at(-1)).toBe('Not sent.')
    }
  })

  it('says there is nothing to answer when allow is heard without a request', () => {
    const { effects } = run([{ type: 'talk' }, heard({ kind: 'allow' })])
    expect(sends(effects)).toEqual([])
    expect(spoken(effects)).toEqual(['Nothing is waiting for an answer.'])
  })
})

describe('flow', () => {
  it('queues items while speaking and reads them in order', () => {
    const turn: Item = { kind: 'notice', say: 'Done.' }
    const { effects, state } = run([
      { type: 'enqueue', item: turn },
      { type: 'enqueue', item: permission },
      { type: 'enqueue', item: permission },
      { type: 'spoken' },
    ])
    expect(spoken(effects)).toEqual(['Done.', 'Run a command. Say allow or deny.'])
    expect(state.queue).toEqual([])
  })

  it('repeats the last sentence and stops on stop', () => {
    const repeated = run([{ type: 'enqueue', item: permission }, { type: 'repeat' }])
    expect(spoken(repeated.effects)).toEqual([
      'Run a command. Say allow or deny.',
      'Run a command. Say allow or deny.',
    ])
    const stopped = run([{ type: 'enqueue', item: permission }, { type: 'spoken' }, heard({ kind: 'stop' })])
    expect(stopped.effects).toContainEqual({ type: 'exit' })
    expect(sends(stopped.effects)).toEqual([])
  })

  it('Talk during a permission listens for its answer', () => {
    const { effects } = run([
      { type: 'enqueue', item: permission },
      { type: 'talk' },
      heard({ kind: 'allow' }),
    ])
    expect(effects.slice(1, 3)).toEqual([{ type: 'silence' }, { type: 'listen' }])
    expect(sends(effects)).toEqual([{ type: 'respond', requestId: 'r1', decision: 'allow' }])
  })
})
