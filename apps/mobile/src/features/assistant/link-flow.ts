import type { TFunction } from '@/core/i18n/create'
import { type AssistantClient, handleAssistantRequest } from './handler'
import { type AssistantLink, sessionByTitle } from './links'
import { defaultSession } from './sessions'

/**
 * What the assistant link screen shows next. `send` and `confirm` wait for the user's tap (any app
 * or web page can open these links); `open` shows the session ready to type.
 */
export type LinkStep =
  | { kind: 'result'; ok: boolean; message: string; sessionId?: string }
  | { kind: 'confirm'; message: string; requestId: string; decision: 'allow' | 'deny' }
  | { kind: 'send'; message: string; text: string; sessionId: string }
  | { kind: 'open'; sessionId: string }

/** First step of a link on the active computer's connection: nothing is sent or answered here. */
export async function resolveAssistantLink(
  link: AssistantLink,
  client: AssistantClient,
  t: TFunction,
): Promise<LinkStep> {
  if (link.kind === 'waiting') {
    return { kind: 'result', ...(await handleAssistantRequest({ action: 'waiting' }, client, t)) }
  }
  if (link.kind === 'answer') {
    const pending = await handleAssistantRequest({ action: 'pending', decision: link.decision }, client, t)
    return pending.ok && pending.requestId
      ? { kind: 'confirm', message: pending.message, requestId: pending.requestId, decision: link.decision }
      : { kind: 'result', ok: false, message: pending.message }
  }
  const reply = await client.request({ type: 'sessions.list' }).catch(() => null)
  const sessions = reply?.type === 'sessions.snapshot' ? reply.sessions : []
  const { sessionId, sessionTitle } = link
  const session = sessionId
    ? sessions.find((s) => s.id === sessionId)
    : sessionTitle
      ? sessionByTitle(sessions, sessionTitle)
      : defaultSession(sessions)
  if (!session) {
    const message = sessionId
      ? t('assistant.sessionGone')
      : sessionTitle
        ? t('assistantLink.noSuchSession', { title: sessionTitle })
        : t('assistant.noSession')
    return { kind: 'result', ok: false, message }
  }
  if (!link.text) return { kind: 'open', sessionId: session.id }
  return {
    kind: 'send',
    message: t('assistantLink.confirmSend', { text: link.text, title: session.title }),
    text: link.text,
    sessionId: session.id,
  }
}
