import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, ActivityIndicator, StyleSheet, View } from 'react-native'
import { useDaemonClient, useIsConnected } from '@/core/connection'
import { space, useTheme } from '@/core/theme'
import { Button, Screen, Text } from '@/ui'
import { handleAssistantRequest } from './handler'
import { type LinkStep, resolveAssistantLink } from './link-flow'
import { type AssistantLink, parseAssistantLink } from './links'

/** No connection after this long: say so instead of waiting forever. */
const CONNECT_TIMEOUT_MS = 10_000
/** A sent reply shows the session after this pause, so the result can be read (or announced). */
const OPEN_SESSION_DELAY_MS = 1_500

type View_ = { kind: 'working' } | Exclude<LinkStep, { kind: 'open' }>

function openSession(sessionId: string) {
  router.replace({ pathname: '/session/[id]', params: { id: sessionId, autofocus: '1' } })
}

/**
 * Where Google Assistant (App Actions) and the launcher shortcuts land: `remoteharness://assistant/
 * <action>`. Runs the same request handler as Siri on the app's connection. Any app or web page can
 * open these links, so a message is only sent, and a permission only answered, after the user
 * confirms here; opening a session to type needs no confirmation.
 */
export function AssistantLinkScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  const action = typeof params.action === 'string' ? params.action : ''
  const client = useDaemonClient()
  const connected = useIsConnected()
  const [view, setView] = useState<View_>({ kind: 'working' })
  const started = useRef(false)
  const link = useRef<AssistantLink | null>(parseAssistantLink(action, params))

  const show = useCallback((next: View_) => {
    setView(next)
    if (next.kind !== 'working') AccessibilityInfo.announceForAccessibility(next.message)
  }, [])

  // Unknown link, or no connection after a while: say so instead of waiting forever.
  useEffect(() => {
    if (!link.current) {
      show({ kind: 'result', ok: false, message: t('assistant.failed') })
      return
    }
    if (connected) return
    const timer = setTimeout(() => {
      if (!started.current) show({ kind: 'result', ok: false, message: t('assistant.unreachable') })
    }, CONNECT_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [connected, show, t])

  // Once connected: resolve the link once (nothing is sent or answered before a tap).
  useEffect(() => {
    const current = link.current
    if (!current || !client || !connected || started.current) return
    started.current = true
    void resolveAssistantLink(current, client, t).then((step) => {
      if (step.kind === 'open') openSession(step.sessionId)
      else show(step)
    })
  }, [client, connected, show, t])

  async function send(confirmed: Extract<View_, { kind: 'send' }>) {
    if (!client) return
    setView({ kind: 'working' })
    const result = await handleAssistantRequest(
      { action: 'reply', text: confirmed.text, sessionId: confirmed.sessionId },
      client,
      t,
    )
    show({ kind: 'result', ...result })
    const sent = result.sessionId
    if (result.ok && sent) setTimeout(() => openSession(sent), OPEN_SESSION_DELAY_MS)
  }

  async function confirm(confirmed: Extract<View_, { kind: 'confirm' }>) {
    if (!client) return
    setView({ kind: 'working' })
    const done = await handleAssistantRequest(
      { action: 'answer', requestId: confirmed.requestId, decision: confirmed.decision },
      client,
      t,
    )
    show({ kind: 'result', ...done })
  }

  return (
    <Screen style={styles.body}>
      {view.kind === 'working' ? (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accent} />
          <Text color="textMuted">
            {connected ? t('assistantLink.working') : t('assistantLink.connecting')}
          </Text>
        </View>
      ) : (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <Text size="xl" weight="bold" style={styles.message} accessibilityRole="header">
            {view.message}
          </Text>
        </View>
      )}
      <View style={styles.actions}>
        {view.kind === 'confirm' ? (
          <>
            <Button
              label={view.decision === 'allow' ? t('permissions.allow') : t('permissions.deny')}
              variant={view.decision === 'allow' ? 'success' : 'danger'}
              onPress={() => void confirm(view)}
            />
            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => show({ kind: 'result', ok: false, message: t('assistantLink.cancelled') })}
            />
          </>
        ) : null}
        {view.kind === 'send' ? (
          <>
            <Button label={t('common.send')} variant="primary" onPress={() => void send(view)} />
            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => show({ kind: 'result', ok: false, message: t('assistantLink.notSent') })}
            />
          </>
        ) : null}
        {view.kind === 'result' && view.ok && view.sessionId ? (
          <Button
            label={t('assistantLink.openSession')}
            variant="primary"
            onPress={() => view.sessionId && openSession(view.sessionId)}
          />
        ) : null}
        {view.kind === 'result' && !view.sessionId ? (
          <Button label={t('assistantLink.openSessions')} onPress={() => router.replace('/')} />
        ) : null}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { padding: space.xl, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  message: { textAlign: 'center' },
  actions: { gap: space.sm },
})
