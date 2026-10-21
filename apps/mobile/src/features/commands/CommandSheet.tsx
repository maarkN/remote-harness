import * as Clipboard from 'expo-clipboard'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { shortPath } from '@/core/utils/time'
import { Button, Text } from '@/ui'
import { exitFailed, exitLabel, formatElapsed, outputText, promptBlock } from './logic'
import { useCommandRun } from './use-command-run'

/** Re-renders every second while a command runs, for the elapsed time. */
function useTicker(active: boolean): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/**
 * "Run command…": a shell command in the session's folder on the computer, confirmed every time,
 * with its output streaming into a monospaced panel. "Add to prompt" hands the command and output
 * to the composer as a fenced block (like Claude Code's `!`).
 */
export function CommandSheet({
  sessionId,
  cwd,
  enabled,
  visible,
  onClose,
  onAddToPrompt,
}: {
  sessionId: string
  cwd: string
  /** The daemon config allows commands (`remote-harness commands on`). */
  enabled: boolean
  visible: boolean
  onClose: () => void
  onAddToPrompt: (block: string) => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useStyles()
  const [command, setCommand] = useState('')
  const [copied, setCopied] = useState(false)
  const { run, running, starting, error, start, cancel, reset } = useCommandRun(sessionId)
  const now = useTicker(running)
  const outputRef = useRef<ScrollView>(null)
  const folder = shortPath(run?.cwd ?? cwd)
  const trimmed = command.trim()

  const close = () => {
    if (running) cancel()
    reset()
    setCopied(false)
    onClose()
  }

  const confirmRun = () => {
    if (!trimmed || running || starting) return
    Alert.alert(t('commands.confirm.title'), t('commands.confirm.body', { command: trimmed, folder }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('commands.run'),
        style: 'destructive',
        onPress: () => {
          setCopied(false)
          void start(trimmed)
        },
      },
    ])
  }

  const copy = async () => {
    if (!run) return
    const ok = await Clipboard.setStringAsync(outputText(run)).catch(() => false)
    setCopied(ok)
  }

  const addToPrompt = () => {
    if (!run) return
    onAddToPrompt(promptBlock(run))
    close()
  }

  const state = run
    ? run.exit
      ? exitLabel(run.exit, t)
      : t('commands.running', { elapsed: formatElapsed(now - run.startedAt) })
    : null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.fill} onPress={close} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <Text weight="bold" accessibilityRole="header">
            {t('commands.title')}
          </Text>
          <Text size="xs" color="textMuted" numberOfLines={1}>
            {t('commands.folder', { folder })}
          </Text>
          {enabled ? (
            <>
              <View style={styles.inputRow}>
                <Text color="accentText" weight="bold">
                  $
                </Text>
                <TextInput
                  value={command}
                  onChangeText={setCommand}
                  placeholder={t('commands.placeholder')}
                  placeholderTextColor={colors.textDim}
                  accessibilityLabel={t('commands.inputLabel')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  returnKeyType="go"
                  onSubmitEditing={confirmRun}
                  editable={!running}
                  style={styles.input}
                />
              </View>
              {error ? (
                <Text size="xs" color="danger">
                  {error}
                </Text>
              ) : null}
              {run ? (
                <View style={styles.output}>
                  <ScrollView
                    ref={outputRef}
                    onContentSizeChange={() => outputRef.current?.scrollToEnd({ animated: false })}
                    contentContainerStyle={styles.outputContent}
                  >
                    {run.clipped ? (
                      <Text size="xs" color="textDim">
                        {t('commands.clipped')}
                      </Text>
                    ) : null}
                    <Text size="xs" selectable>
                      {run.segments.map((segment, index) => (
                        <Text
                          // biome-ignore lint/suspicious/noArrayIndexKey: segments only grow at the end.
                          key={index}
                          size="xs"
                          color={segment.stream === 'stderr' ? 'warning' : 'text'}
                        >
                          {segment.text}
                        </Text>
                      ))}
                    </Text>
                  </ScrollView>
                </View>
              ) : null}
              {state ? (
                <View style={styles.state} accessibilityLiveRegion="polite">
                  {running ? <ActivityIndicator size="small" color={colors.accentText} /> : null}
                  <Text
                    size="xs"
                    color={run?.exit ? (exitFailed(run.exit) ? 'danger' : 'success') : 'textMuted'}
                  >
                    {state}
                  </Text>
                </View>
              ) : null}
              <View style={styles.actions}>
                {running ? (
                  <Button label={t('commands.cancel')} variant="danger" onPress={cancel} flex />
                ) : (
                  <Button
                    label={t('commands.run')}
                    variant="primary"
                    onPress={confirmRun}
                    loading={starting}
                    disabled={!trimmed}
                    flex
                  />
                )}
                {run && !running ? (
                  <>
                    <Button
                      label={copied ? t('commands.copied') : t('commands.copy')}
                      onPress={() => void copy()}
                      flex
                    />
                    <Button label={t('commands.addToPrompt')} onPress={addToPrompt} flex />
                  </>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.off}>
              <Text size="sm">{t('commands.off.body')}</Text>
              <Text size="sm" color="accentText" selectable>
                $ remote-harness commands on
              </Text>
            </View>
          )}
          <Button label={t('common.close')} variant="ghost" onPress={close} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const useStyles = makeStyles((theme) => ({
  backdrop: { flex: 1, backgroundColor: theme.colors.backdrop, justifyContent: 'flex-end' },
  fill: { flex: 1 },
  sheet: {
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    gap: space.sm,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    paddingVertical: space.sm,
    color: theme.colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
  },
  output: {
    flexShrink: 1,
    minHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  outputContent: { padding: space.sm },
  state: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm },
  off: { gap: space.sm, paddingVertical: space.sm },
}))
