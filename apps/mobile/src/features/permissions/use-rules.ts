import type { ApprovalEntry, ClientRequest, RuleFile } from '@remote-harness/protocol'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DaemonRequestError, useDaemonClient, useIsConnected } from '@/core/connection'
import { errorMessage } from '@/core/connection/error-message'

/** An older daemon answers the new messages with `unknown_type`. */
const unsupported = (error: unknown) => error instanceof DaemonRequestError && error.code === 'unknown_type'

/** The computer's always-allow rules (`rules.list`), with undo and delete. */
export function useRules() {
  const { t } = useTranslation()
  const client = useDaemonClient()
  const connected = useIsConnected()
  const [files, setFiles] = useState<RuleFile[] | null>(null)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!client) return
    try {
      const reply = await client.request({ type: 'rules.list' })
      if (reply.type === 'rules.result') setFiles(reply.files)
      setError(null)
    } catch (e) {
      if (unsupported(e)) setSupported(false)
      else setError(errorMessage(e, t))
    }
  }, [client, t])

  useEffect(() => {
    if (connected) void refresh()
  }, [connected, refresh])

  const run = useCallback(
    async (request: ClientRequest) => {
      if (!client) return
      try {
        await client.request(request)
        setError(null)
      } catch (e) {
        setError(errorMessage(e, t))
      }
      await refresh()
    },
    [client, refresh, t],
  )

  const undo = useCallback((ruleId: string) => run({ type: 'rules.undo', ruleId }), [run])
  const remove = useCallback((file: string, rule: string) => run({ type: 'rules.delete', file, rule }), [run])

  return { files, supported, error, refresh, undo, remove }
}

/** The approval log (`approvals.list`). */
export function useApprovals() {
  const { t } = useTranslation()
  const client = useDaemonClient()
  const connected = useIsConnected()
  const [entries, setEntries] = useState<ApprovalEntry[] | null>(null)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!client) return
    try {
      const reply = await client.request({ type: 'approvals.list' })
      if (reply.type === 'approvals.result') setEntries(reply.entries)
      setError(null)
    } catch (e) {
      if (unsupported(e)) setSupported(false)
      else setError(errorMessage(e, t))
    }
  }, [client, t])

  useEffect(() => {
    if (connected) void refresh()
  }, [connected, refresh])

  return { entries, supported, error, refresh }
}
