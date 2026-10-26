import type { ServerMessage, ServerMessageOf, ServerMessageType } from '@remote-harness/protocol'
import { useCallback, useState } from 'react'
import { useDaemonClient } from '@/core/connection'

export type ChangeAction = 'commit' | 'push' | 'pr' | 'generate'

/** A commit runs the repository's hooks; a PR pushes and talks to GitHub. */
const COMMIT_TIMEOUT_MS = 150_000
const PUSH_TIMEOUT_MS = 90_000
const PR_TIMEOUT_MS = 150_000
const GENERATE_TIMEOUT_MS = 60_000

function replyOf<T extends ServerMessageType>(reply: ServerMessage, type: T): ServerMessageOf<T> {
  if (reply.type !== type) throw new Error(`unexpected reply ${reply.type}`)
  return reply as ServerMessageOf<T>
}

/** Commit, push, PR and message generation for a session; `busy` is the action in flight. */
export function useChangeActions(sessionId: string) {
  const client = useDaemonClient()
  const [busy, setBusy] = useState<ChangeAction | null>(null)

  const run = useCallback(async <T>(action: ChangeAction, request: () => Promise<T>): Promise<T> => {
    setBusy(action)
    try {
      return await request()
    } finally {
      setBusy(null)
    }
  }, [])

  const need = useCallback(() => {
    if (!client) throw new Error('not connected')
    return client
  }, [client])

  const commit = useCallback(
    (request: { paths: string[]; message: string; newBranch?: string; force: boolean }) =>
      run('commit', async () => {
        const reply = await need().request(
          { type: 'changes.commit', sessionId, ...request },
          { timeoutMs: COMMIT_TIMEOUT_MS },
        )
        return replyOf(reply, 'changes.committed')
      }),
    [need, run, sessionId],
  )

  const push = useCallback(
    (force: boolean) =>
      run('push', async () => {
        const reply = await need().request(
          { type: 'changes.push', sessionId, force },
          { timeoutMs: PUSH_TIMEOUT_MS },
        )
        return replyOf(reply, 'changes.pushed')
      }),
    [need, run, sessionId],
  )

  const pr = useCallback(
    (request: { title: string; body: string; force: boolean }) =>
      run('pr', async () => {
        const reply = await need().request(
          { type: 'changes.pr', sessionId, ...request },
          { timeoutMs: PR_TIMEOUT_MS },
        )
        return replyOf(reply, 'changes.prOpened')
      }),
    [need, run, sessionId],
  )

  const generate = useCallback(
    (kind: 'commit' | 'pr', paths?: string[]) =>
      run('generate', async () => {
        const reply = await need().request(
          { type: 'changes.generate', sessionId, kind, ...(paths ? { paths } : {}) },
          { timeoutMs: GENERATE_TIMEOUT_MS },
        )
        return replyOf(reply, 'changes.generated')
      }),
    [need, run, sessionId],
  )

  return { busy, commit, push, pr, generate }
}
