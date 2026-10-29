import type { ClientRequest, PermissionRequestInfo, ServerMessage, Session } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'
import { describePermission } from '../permissions/describe'
import { defaultSession } from './sessions'

/** What a voice assistant asks the app to do (iOS App Intents, Android App Actions). */
export type AssistantRequest =
  | { action: 'reply'; sessionId?: string; text: string }
  | { action: 'pending'; decision: 'allow' | 'deny' }
  | { action: 'answer'; requestId: string; decision: 'allow' | 'deny' }
  | { action: 'waiting' }

/**
 * The answer the assistant speaks: `message` in the app language. `pending` also returns the request
 * it describes (`requestId`), which `answer` then sends, so the confirmed request is the one answered.
 */
export type AssistantReply = { ok: boolean; message: string; requestId?: string; sessionId?: string }

/** The part of `DaemonClient` the handler needs (a short-lived connection to the active computer). */
export type AssistantClient = { request(message: ClientRequest): Promise<ServerMessage> }

/** Requests the assistant can answer by voice: plain permissions, not questions, plans or handovers. */
export function answerableByVoice(request: Pick<PermissionRequestInfo, 'interaction' | 'terminal'>): boolean {
  return !request.interaction && !request.terminal
}

/** Parses the payload the native side sends; `null` when it is not a known request. */
export function parseAssistantRequest(source: unknown): AssistantRequest | null {
  if (!source || typeof source !== 'object') return null
  const r = source as Record<string, unknown>
  const decision = r.decision === 'allow' || r.decision === 'deny' ? r.decision : null
  switch (r.action) {
    case 'reply':
      return typeof r.text === 'string'
        ? {
            action: 'reply',
            text: r.text,
            ...(typeof r.sessionId === 'string' && r.sessionId ? { sessionId: r.sessionId } : {}),
          }
        : null
    case 'pending':
      return decision ? { action: 'pending', decision } : null
    case 'answer':
      return decision && typeof r.requestId === 'string' && r.requestId
        ? { action: 'answer', requestId: r.requestId, decision }
        : null
    case 'waiting':
      return { action: 'waiting' }
    default:
      return null
  }
}

async function sessionsOf(client: AssistantClient): Promise<Session[]> {
  const reply = await client.request({ type: 'sessions.list' })
  return reply.type === 'sessions.snapshot' ? reply.sessions : []
}

async function requestsOf(client: AssistantClient): Promise<PermissionRequestInfo[]> {
  const reply = await client.request({ type: 'permissions.list' })
  return reply.type === 'permissions.result' ? reply.requests : []
}

function byAge(a: PermissionRequestInfo, b: PermissionRequestInfo): number {
  return a.createdAt.localeCompare(b.createdAt)
}

async function reply(
  client: AssistantClient,
  request: Extract<AssistantRequest, { action: 'reply' }>,
  t: TFunction,
): Promise<AssistantReply> {
  const text = request.text.trim()
  if (!text) return { ok: false, message: t('assistant.emptyText') }
  const sessions = await sessionsOf(client)
  const session = request.sessionId
    ? sessions.find((s) => s.id === request.sessionId)
    : (defaultSession(sessions) ?? undefined)
  if (!session) {
    return {
      ok: false,
      message: request.sessionId ? t('assistant.sessionGone') : t('assistant.noSession'),
    }
  }
  if (session.state === 'ended') return { ok: false, message: t('assistant.ended', { title: session.title }) }
  if (!session.controllable) {
    return { ok: false, message: t('assistant.readOnly', { title: session.title }) }
  }
  await client.request({ type: 'session.input', sessionId: session.id, text, mode: 'auto' })
  return { ok: true, message: t('assistant.sent', { title: session.title }), sessionId: session.id }
}

async function pending(
  client: AssistantClient,
  decision: 'allow' | 'deny',
  t: TFunction,
): Promise<AssistantReply> {
  const requests = (await requestsOf(client)).sort(byAge)
  const request = requests.find(answerableByVoice)
  if (!request) {
    return {
      ok: false,
      message: requests.length > 0 ? t('assistant.onlyQuestions') : t('assistant.noPending'),
    }
  }
  const sessions = await sessionsOf(client)
  const session = sessions.find((s) => s.id === request.sessionId)
  const action = describePermission(request, t).title
  const key = decision === 'allow' ? 'assistant.confirmAllow' : 'assistant.confirmDeny'
  return {
    ok: true,
    message: t(key, { action, title: session?.title ?? t('common.session') }),
    requestId: request.requestId,
    sessionId: request.sessionId,
  }
}

async function answer(
  client: AssistantClient,
  request: Extract<AssistantRequest, { action: 'answer' }>,
  t: TFunction,
): Promise<AssistantReply> {
  const waiting = await requestsOf(client)
  if (!waiting.some((r) => r.requestId === request.requestId)) {
    return { ok: false, message: t('assistant.answerGone') }
  }
  await client.request({
    type: 'permission.respond',
    requestId: request.requestId,
    decision: request.decision,
  })
  return { ok: true, message: request.decision === 'allow' ? t('assistant.allowed') : t('assistant.denied') }
}

async function waiting(client: AssistantClient, t: TFunction): Promise<AssistantReply> {
  const sessions = (await sessionsOf(client)).filter((s) => s.state !== 'ended')
  const waitingOnes = sessions.filter((s) => s.state === 'waiting')
  const running = sessions.filter((s) => s.state === 'running').length
  const head =
    waitingOnes.length === 0
      ? t('assistant.waitingNone')
      : t('assistant.waiting', {
          count: waitingOnes.length,
          titles: waitingOnes.map((s) => `“${s.title}”`).join(', '),
        })
  const tail = running > 0 ? ` ${t('assistant.running', { count: running })}` : ''
  return { ok: true, message: `${head}${tail}` }
}

/**
 * Turns an assistant request into protocol messages on one connection to the active computer and
 * returns the sentence to speak. A rejected request (the computer refused or timed out) is a failure.
 */
export async function handleAssistantRequest(
  request: AssistantRequest,
  client: AssistantClient,
  t: TFunction,
): Promise<AssistantReply> {
  try {
    switch (request.action) {
      case 'reply':
        return await reply(client, request, t)
      case 'pending':
        return await pending(client, request.decision, t)
      case 'answer':
        return await answer(client, request, t)
      case 'waiting':
        return await waiting(client, t)
    }
  } catch {
    return { ok: false, message: t('assistant.failed') }
  }
}
