import { useIsFocused } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, StyleSheet, View } from 'react-native'
import { useDaemonClient, useDaemonEvent } from '@/core/connection'
import { errorMessage } from '@/core/connection/error-message'
import type { TFunction } from '@/core/i18n/create'
import { space } from '@/core/theme'
import { ConnectionBanner, Screen, Text } from '@/ui'
import { DEFAULT_KEYS, KeyBar, type KeySpec } from '../conversation/components/KeyBar'
import { TerminalView, type TerminalViewHandle } from './TerminalView'

function terminalKeys(t: TFunction): KeySpec[] {
  return [
    ...DEFAULT_KEYS,
    ...(['4', '5', '6', '7', '8', '9'] as const).map((key) => ({ key, label: key })),
    { key: 'Space', label: t('terminal.space') },
    { key: 'BSpace', label: '⌫' },
  ]
}

/** Whether the app is in the foreground. */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active')
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'))
    return () => subscription.remove()
  }, [])
  return active
}

/**
 * Live mirror of the session's tmux pane, for TUI menus and dialogs the transcript can't show. Frames
 * stream only while it can be seen: its screen (or the session screen holding the tablet inspector)
 * is focused and the app is in the foreground. `wrapKeys` shows every key at once (the inspector).
 */
export function TerminalScreen({ sessionId, wrapKeys = false }: { sessionId: string; wrapKeys?: boolean }) {
  const { t } = useTranslation()
  const keys = useMemo(() => terminalKeys(t), [t])
  const client = useDaemonClient()
  const terminal = useRef<TerminalViewHandle>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastFrame = useRef<{ text: string; cols: number; rows: number } | null>(null)
  const focused = useIsFocused()
  const active = useAppActive()
  const visible = focused && active

  useDaemonEvent('pane.frame', (frame) => {
    if (frame.sessionId !== sessionId) return
    lastFrame.current = frame
    if (ready) terminal.current?.render(frame)
  })

  useEffect(() => {
    if (ready && lastFrame.current) terminal.current?.render(lastFrame.current)
  }, [ready])

  useEffect(() => {
    if (!client || !visible) return
    const subscribe = () => {
      client.request({ type: 'pane.subscribe', sessionId }).then(
        () => setError(null),
        (e: unknown) => setError(errorMessage(e, t)),
      )
    }
    const off = client.onReady(subscribe)
    if (client.status === 'open') subscribe()
    return () => {
      off()
      client.send({ type: 'pane.unsubscribe', sessionId })
    }
  }, [client, sessionId, t, visible])

  return (
    <Screen>
      <ConnectionBanner />
      {error ? (
        <Text size="sm" color="danger" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.flex}>
        <TerminalView ref={terminal} onReady={() => setReady(true)} />
      </View>
      <KeyBar
        keys={keys}
        wrap={wrapKeys}
        onKey={(key) => client?.send({ type: 'session.key', sessionId, key })}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({ flex: { flex: 1 }, error: { padding: space.md } })
