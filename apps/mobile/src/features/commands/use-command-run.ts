import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDaemonClient } from '@/core/connection'
import { errorMessage } from '@/core/connection/error-message'
import { appendOutput, type CommandRun, newRun } from './logic'

/**
 * One shell command at a time for a session: starts it, follows its output and exit (sent only to
 * this connection), cancels it. A run still going when the sheet unmounts is cancelled.
 */
export function useCommandRun(sessionId: string) {
  const client = useDaemonClient()
  const { t } = useTranslation()
  const [run, setRun] = useState<CommandRun | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runIdRef = useRef<string | null>(null)
  const running = run !== null && run.exit === null

  useEffect(() => {
    if (!client) return
    const offOutput = client.on('command.output', (message) => {
      if (message.runId !== runIdRef.current) return
      setRun((current) =>
        current?.runId === message.runId ? appendOutput(current, message.stream, message.text) : current,
      )
    })
    const offExit = client.on('command.exit', (message) => {
      if (message.runId !== runIdRef.current) return
      const { type: _type, runId: _runId, ...exit } = message
      setRun((current) => (current?.runId === message.runId ? { ...current, exit } : current))
    })
    return () => {
      offOutput()
      offExit()
    }
  }, [client])

  const start = useCallback(
    async (command: string) => {
      if (!client) return
      setStarting(true)
      setError(null)
      try {
        const reply = await client.request({ type: 'command.run', sessionId, command })
        if (reply.type !== 'command.started') throw new Error(`unexpected reply ${reply.type}`)
        runIdRef.current = reply.runId
        setRun(newRun(reply.runId, command, reply.cwd, Date.now()))
      } catch (e) {
        setError(
          errorMessage(e, t, {
            commands_disabled: t('commands.errors.disabled'),
            session_busy: t('commands.errors.busy'),
          }),
        )
      } finally {
        setStarting(false)
      }
    },
    [client, sessionId, t],
  )

  const cancel = useCallback(() => {
    const runId = runIdRef.current
    if (!client || !runId) return
    client.request({ type: 'command.cancel', runId }).catch(() => undefined)
  }, [client])

  // Leaving the sheet stops a command that is still running.
  const runningRef = useRef(running)
  runningRef.current = running
  useEffect(() => () => (runningRef.current ? cancel() : undefined), [cancel])

  const reset = useCallback(() => {
    runIdRef.current = null
    setRun(null)
    setError(null)
  }, [])

  return { run, running, starting, error, start, cancel, reset }
}
