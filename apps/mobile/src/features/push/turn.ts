import type { ClientRequest } from '@remote-harness/protocol'

/** Categories the daemon puts on turn pushes (`TURN_QUEUE`: the session has queued prompts). */
export const TURN_CATEGORY = 'TURN'
export const TURN_QUEUE_CATEGORY = 'TURN_QUEUE'
export const ACTION_REPLY = 'REPLY'
export const ACTION_REPLY_VOICE = 'REPLY_VOICE'
export const ACTION_INTERRUPT = 'INTERRUPT'
export const ACTION_SEND_NEXT = 'SEND_NEXT'
/** Android channel of turn pushes drawn by the app: private on the lock screen, so its actions need an unlock. */
export const TURN_CHANNEL_ID = 'turn'
/** `data.push` of the daemon's Android data message for a turn push. */
export const TURN_DATA_PUSH = 'turn'

export type TurnAction = 'reply' | 'voice' | 'interrupt' | 'sendNext'

const ACTIONS: Record<string, TurnAction> = {
  [ACTION_REPLY]: 'reply',
  [ACTION_REPLY_VOICE]: 'voice',
  [ACTION_INTERRUPT]: 'interrupt',
  [ACTION_SEND_NEXT]: 'sendNext',
}

export function turnActionOf(identifier: string): TurnAction | null {
  return ACTIONS[identifier] ?? null
}

/** The request a turn action sends to the computer; null for voice (it opens the app) and an empty reply. */
export function turnRequest(action: TurnAction, sessionId: string, userText?: string): ClientRequest | null {
  if (action === 'reply') {
    const text = userText?.trim() ?? ''
    return text ? { type: 'session.input', sessionId, text, mode: 'auto' } : null
  }
  if (action === 'interrupt') return { type: 'session.key', sessionId, key: 'Escape' }
  if (action === 'sendNext') return { type: 'queue.sendNext', sessionId }
  return null
}

export type TurnActionLabels = {
  reply: string
  replyPlaceholder: string
  send: string
  voice: string
  interrupt: string
  sendNext: string
}

/** A category action in the shape `setNotificationCategoryAsync` takes (no native import here). */
export type CategoryAction = {
  identifier: string
  buttonTitle: string
  textInput?: { submitButtonTitle: string; placeholder: string }
  options: { opensAppToForeground: boolean; isAuthenticationRequired: true; isDestructive?: boolean }
}

/** The actions of a turn category; every one needs the device unlocked. */
export function turnCategoryActions(queue: boolean, labels: TurnActionLabels): CategoryAction[] {
  const background = { opensAppToForeground: false, isAuthenticationRequired: true } as const
  return [
    {
      identifier: ACTION_REPLY,
      buttonTitle: labels.reply,
      textInput: { submitButtonTitle: labels.send, placeholder: labels.replyPlaceholder },
      options: background,
    },
    {
      identifier: ACTION_REPLY_VOICE,
      buttonTitle: labels.voice,
      options: { opensAppToForeground: true, isAuthenticationRequired: true },
    },
    ...(queue ? [{ identifier: ACTION_SEND_NEXT, buttonTitle: labels.sendNext, options: background }] : []),
    {
      identifier: ACTION_INTERRUPT,
      buttonTitle: labels.interrupt,
      options: { ...background, isDestructive: true },
    },
  ]
}

/** A turn push the app draws itself on Android: what to show, its category and the push's identifiers. */
export type TurnData = { title: string; body: string; category: string; data: Record<string, string> }

/** The daemon's turn data message (`data.push === 'turn'`); null for anything else. */
export function parseTurnData(source: unknown): TurnData | null {
  if (!source || typeof source !== 'object') return null
  const record = source as Record<string, unknown>
  if (record.push !== TURN_DATA_PUSH || typeof record.sessionId !== 'string' || !record.sessionId) return null
  const category = record.category
  if (category !== TURN_CATEGORY && category !== TURN_QUEUE_CATEGORY) return null
  const data: Record<string, string> = {}
  for (const key of ['sessionId', 'profileId', 'event', 'daemonId'] as const) {
    const value = record[key]
    if (typeof value === 'string') data[key] = value
  }
  return {
    title: typeof record.title === 'string' ? record.title : '',
    body: typeof record.body === 'string' ? record.body : '',
    category,
    data,
  }
}
