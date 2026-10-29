import type { Question } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'
import type { Command } from './commands'

/** Something read aloud that waits for an answer. */
export type Prompt =
  | { kind: 'permission'; requestId: string; say: string }
  | {
      kind: 'question'
      requestId: string
      questions: Question[]
      /** What is read for each question (`questionSentence`), same order as `questions`. */
      says: string[]
      index: number
      answers: Record<string, string>
      say: string
    }
  /** A message heard after Talk, read back until "yes" or "no". */
  | { kind: 'confirm'; text: string; say: string }
  /** Talk was pressed: listening for a message or a command. */
  | { kind: 'talk'; say: '' }

/** Read aloud, no answer expected (an answer, a result, a request that needs the screen). */
export type Notice = { kind: 'notice'; say: string }

export type Item = Prompt | Notice

export type Phase = 'idle' | 'speaking' | 'listening'

export type HandsFreeState = {
  current: Item | null
  queue: Item[]
  phase: Phase
  /** Last sentence spoken, for Repeat. */
  lastSaid: string
  /** Misunderstood answers to the current prompt; at 2 it is left for the screen. */
  misses: number
}

export type Effect =
  | { type: 'speak'; text: string }
  /** Stop speaking now (the item went away, or Talk interrupts it). */
  | { type: 'silence' }
  | { type: 'listen' }
  | { type: 'haptic' }
  | { type: 'respond'; requestId: string; decision: 'allow' | 'deny' }
  | { type: 'answer'; requestId: string; answers: Record<string, string> }
  | { type: 'send'; text: string }
  | { type: 'exit' }

export type HandsFreeEvent =
  | { type: 'enqueue'; item: Item }
  /** The current speech ended. */
  | { type: 'spoken' }
  | { type: 'heard'; command: Command }
  | { type: 'talk' }
  | { type: 'repeat' }
  /** A request was answered elsewhere (the screen, another phone) or expired. */
  | { type: 'resolved'; requestId: string }

export const INITIAL_STATE: HandsFreeState = {
  current: null,
  queue: [],
  phase: 'idle',
  lastSaid: '',
  misses: 0,
}

type Step = { state: HandsFreeState; effects: Effect[] }

const MAX_MISSES = 2

function waitsForAnswer(item: Item | null): item is Exclude<Prompt, { kind: 'talk' }> {
  return item?.kind === 'permission' || item?.kind === 'question' || item?.kind === 'confirm'
}

function requestOf(item: Item | null): string | null {
  return item?.kind === 'permission' || item?.kind === 'question' ? item.requestId : null
}

function start(state: HandsFreeState, item: Item, extra: Effect[] = []): Step {
  return {
    state: { ...state, current: item, phase: 'speaking', lastSaid: item.say, misses: 0 },
    effects: [...extra, { type: 'speak', text: item.say }],
  }
}

/** The next queued item, or idle. */
function next(state: HandsFreeState, extra: Effect[] = []): Step {
  const [item, ...queue] = state.queue
  if (!item) return { state: { ...state, current: null, phase: 'idle', misses: 0 }, effects: extra }
  return start({ ...state, queue }, item, extra)
}

/** Says something now (a result) and then moves on. */
function notice(state: HandsFreeState, say: string, extra: Effect[] = []): Step {
  return start(state, { kind: 'notice', say }, extra)
}

/** Did not understand: hint and listen again, or leave it for the screen after two misses. */
function miss(state: HandsFreeState, hint: string, t: TFunction): Step {
  const current = state.current
  if (!current) return next(state)
  if (state.misses + 1 >= MAX_MISSES) return notice(state, t('handsFree.answerOnScreen'))
  const say = `${t('handsFree.didntGet')} ${hint}`
  return {
    state: { ...state, phase: 'speaking', lastSaid: say, misses: state.misses + 1 },
    effects: [{ type: 'speak', text: say }],
  }
}

function answerQuestion(
  state: HandsFreeState,
  prompt: Extract<Prompt, { kind: 'question' }>,
  command: Command,
  t: TFunction,
): Step {
  const question = prompt.questions[prompt.index]
  if (!question) return next(state)
  let answer: string | null = null
  if (question.kind === 'choice' && question.options.length > 0) {
    if (command.kind !== 'options')
      return miss(state, question.multiSelect ? t('handsFree.sayOptions') : t('handsFree.sayOption'), t)
    const count = question.options.length
    const valid =
      command.numbers.every((n) => n >= 1 && n <= count) &&
      (question.multiSelect || command.numbers.length === 1)
    if (!valid) return miss(state, t('handsFree.optionsAre', { count }), t)
    answer = question.options
      .filter((_, index) => command.numbers.includes(index + 1))
      .map((option) => option.label)
      .join(', ')
  } else {
    if (command.kind !== 'message') return miss(state, t('handsFree.sayAnswer'), t)
    answer = command.text
  }
  const answers = { ...prompt.answers, [question.question]: answer }
  const index = prompt.index + 1
  const say = prompt.says[index]
  if (index < prompt.questions.length && say !== undefined) {
    return start(state, { ...prompt, index, answers, say })
  }
  return notice(state, t('handsFree.answered'), [
    { type: 'answer', requestId: prompt.requestId, answers },
    { type: 'haptic' },
  ])
}

function heard(state: HandsFreeState, command: Command, t: TFunction): Step {
  if (command.kind === 'stop')
    return { state: INITIAL_STATE, effects: [{ type: 'silence' }, { type: 'exit' }] }
  if (command.kind === 'repeat' && state.lastSaid) {
    return { state: { ...state, phase: 'speaking' }, effects: [{ type: 'speak', text: state.lastSaid }] }
  }
  const current = state.current
  switch (current?.kind) {
    case 'permission':
      if (command.kind === 'allow' || command.kind === 'deny') {
        return notice(state, command.kind === 'allow' ? t('handsFree.allowed') : t('handsFree.denied'), [
          { type: 'respond', requestId: current.requestId, decision: command.kind },
          { type: 'haptic' },
        ])
      }
      // Silence leaves the request on the screen.
      if (command.kind === 'empty') return next(state)
      return miss(state, t('handsFree.sayAllowDeny'), t)
    case 'question':
      if (command.kind === 'empty') return next(state)
      return answerQuestion(state, current, command, t)
    case 'confirm':
      if (command.kind === 'yes') {
        return notice(state, t('handsFree.sent'), [{ type: 'send', text: current.text }, { type: 'haptic' }])
      }
      if (command.kind === 'no' || command.kind === 'empty') return notice(state, t('handsFree.notSent'))
      return miss(state, current.say, t)
    default:
      // Talk, or nothing to answer.
      if (command.kind === 'message') {
        return start(state, {
          kind: 'confirm',
          text: command.text,
          say: t('handsFree.confirmSend', { text: command.text }),
        })
      }
      if (command.kind === 'empty') return next(state)
      if (command.kind === 'allow' || command.kind === 'deny' || command.kind === 'options') {
        return notice(state, t('handsFree.nothingToAnswer'))
      }
      return notice(state, t('handsFree.didntGet'))
  }
}

/** One step of the hands-free mode: the next state and what to do. Pure; the hook runs the effects. */
export function step(state: HandsFreeState, event: HandsFreeEvent, t: TFunction): Step {
  switch (event.type) {
    case 'enqueue': {
      const id = requestOf(event.item)
      if (id && [state.current, ...state.queue].some((item) => requestOf(item) === id))
        return { state, effects: [] }
      if (state.current === null && state.phase === 'idle') return start(state, event.item)
      return { state: { ...state, queue: [...state.queue, event.item] }, effects: [] }
    }
    case 'spoken':
      if (state.phase !== 'speaking') return { state, effects: [] }
      if (waitsForAnswer(state.current)) {
        return { state: { ...state, phase: 'listening' }, effects: [{ type: 'listen' }, { type: 'haptic' }] }
      }
      return next(state)
    case 'heard':
      return heard({ ...state, phase: 'idle' }, event.command, t)
    case 'talk': {
      const silence: Effect[] = state.phase === 'speaking' ? [{ type: 'silence' }] : []
      if (waitsForAnswer(state.current)) {
        return {
          state: { ...state, phase: 'listening' },
          effects: [...silence, { type: 'listen' }, { type: 'haptic' }],
        }
      }
      // An unanswered notice is dropped: the user wants to speak now.
      return {
        state: { ...state, current: { kind: 'talk', say: '' }, phase: 'listening', misses: 0 },
        effects: [...silence, { type: 'listen' }, { type: 'haptic' }],
      }
    }
    case 'repeat':
      if (!state.lastSaid) return { state, effects: [] }
      return {
        state: { ...state, phase: 'speaking' },
        effects: [{ type: 'silence' }, { type: 'speak', text: state.lastSaid }],
      }
    case 'resolved': {
      const queue = state.queue.filter((item) => requestOf(item) !== event.requestId)
      if (requestOf(state.current) === event.requestId)
        return next({ ...state, queue }, [{ type: 'silence' }])
      return { state: { ...state, queue }, effects: [] }
    }
  }
}
