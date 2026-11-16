import type { PermissionAnswer, Question } from '@remote-harness/protocol'
import { Check, MessageCircleQuestionMark } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native'
import { useKeyboardHeight } from '@/core/platform/use-keyboard-height'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { agentLabel } from '@/features/sessions/agent'
import { Button, Text } from '@/ui'
import {
  buildAnswers,
  EMPTY_SELECTION,
  questionBodyHeight,
  type Selection,
  setOther,
  stepAt,
  toggleOption,
} from '../interaction'

type Props = {
  questions: Question[]
  title: string | null
  busy: boolean
  onAnswer: (answer: PermissionAnswer) => void
  onDecline: () => void
}

/**
 * `AskUserQuestion` as a native card, one question at a time like the agent's own prompt: options,
 * free-text "Other", Back / Next between the questions of one call, Send on the last and Decline.
 * The free-text field always has a way to close the keyboard (Return on single-line fields, Done
 * beside it while focused), and with the keyboard up the options area shrinks so the field and the
 * buttons stay above it (#560).
 */
export function QuestionCard({ questions, title, busy, onAnswer, onDecline }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const [selections, setSelections] = useState<Record<string, Selection>>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [focused, setFocused] = useState(false)
  const body = useRef<ScrollView>(null)
  const keyboardHeight = useKeyboardHeight()
  const { height: windowHeight } = useWindowDimensions()
  const keyboardOpen = keyboardHeight > 0
  // The field is the last thing in the body: keep it in view once the keyboard is up.
  useEffect(() => {
    if (focused && keyboardOpen) body.current?.scrollToEnd({ animated: true })
  }, [focused, keyboardOpen])
  const update = (question: string, change: (s: Selection) => Selection) =>
    setSelections((all) => ({ ...all, [question]: change(all[question] ?? EMPTY_SELECTION) }))
  const step = stepAt(questions, selections, stepIndex)
  if (!step) return null
  const { question: q, index, total, answered, last, complete } = step
  const selection = selections[q.question] ?? EMPTY_SELECTION
  const multiline = q.kind === 'text'

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MessageCircleQuestionMark size={16} color={colors.accentText} />
        <Text weight="bold" color="accentText" style={styles.flex} numberOfLines={2}>
          {title ?? t('permissions.question.title', { agent: agentLabel(null, t, { sentence: true }) })}
        </Text>
      </View>
      <ScrollView
        ref={body}
        style={{ maxHeight: questionBodyHeight(windowHeight, keyboardHeight) }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        onLayout={() => {
          if (focused && keyboardOpen) body.current?.scrollToEnd({ animated: false })
        }}
      >
        <View key={q.question} style={styles.question}>
          {total > 1 ? (
            <Text size="xs" color="accentText" weight="medium">
              {t('permissions.question.progress', { n: index + 1, total })}
            </Text>
          ) : null}
          {q.header ? (
            <Text size="xs" color="textMuted">
              {q.header}
            </Text>
          ) : null}
          <Text size="sm" weight="medium" selectable>
            {q.question}
          </Text>
          {q.multiSelect ? (
            <Text size="xs" color="textMuted">
              {t('permissions.question.multi')}
            </Text>
          ) : null}
          {q.options.map((option) => {
            const picked = selection.picked.includes(option.label)
            return (
              <Pressable
                key={option.label}
                accessibilityRole={q.multiSelect ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: picked }}
                disabled={busy}
                onPress={() => update(q.question, (s) => toggleOption(s, option.label, q.multiSelect))}
                style={[styles.option, picked && styles.optionPicked]}
              >
                <View style={[styles.mark, !q.multiSelect && styles.markRound, picked && styles.markPicked]}>
                  {picked ? <Check size={12} color={colors.accentInk} /> : null}
                </View>
                <View style={styles.flex}>
                  <Text size="sm">{option.label}</Text>
                  {option.description ? (
                    <Text size="xs" color="textMuted">
                      {option.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )
          })}
          <View style={styles.field}>
            <TextInput
              value={selection.other}
              onChangeText={(text) => update(q.question, (s) => setOther(s, text, q.multiSelect))}
              placeholder={t(
                q.kind === 'choice' ? 'permissions.question.other' : 'permissions.question.answer',
              )}
              placeholderTextColor={colors.textMuted}
              keyboardType={q.kind === 'number' ? 'numeric' : 'default'}
              editable={!busy}
              multiline={multiline}
              // Single-line fields close the keyboard from Return; a multiline one keeps it for new lines.
              returnKeyType={multiline ? 'default' : 'done'}
              submitBehavior={multiline ? 'newline' : 'blurAndSubmit'}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={[styles.input, styles.flex]}
            />
            {focused ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('permissions.question.done')}
                accessibilityHint={t('conversation.hideKeyboard')}
                hitSlop={8}
                onPress={Keyboard.dismiss}
                style={({ pressed }) => [styles.done, pressed && styles.pressed]}
              >
                <Text size="sm" weight="bold" color="accentText">
                  {t('permissions.question.done')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <Button
          label={t('permissions.question.decline')}
          variant="danger"
          compact
          flex
          disabled={busy}
          onPress={onDecline}
        />
        {index > 0 ? (
          <Button
            label={t('permissions.question.back')}
            variant="secondary"
            compact
            disabled={busy}
            onPress={() => setStepIndex(index - 1)}
          />
        ) : null}
        {last ? (
          <Button
            label={t('permissions.question.send')}
            variant="primary"
            compact
            flex
            loading={busy}
            disabled={!complete}
            onPress={() => onAnswer({ kind: 'question', answers: buildAnswers(questions, selections) })}
          />
        ) : (
          <Button
            label={t('permissions.question.next')}
            variant="primary"
            compact
            flex
            disabled={busy || !answered}
            onPress={() => setStepIndex(index + 1)}
          />
        )}
      </View>
    </View>
  )
}

const useStyles = makeStyles((theme) => ({
  card: {
    margin: space.sm,
    padding: space.md,
    gap: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  question: { gap: space.xs, paddingVertical: space.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  optionPicked: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
  mark: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markRound: { borderRadius: 9 },
  markPicked: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  field: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  done: { paddingHorizontal: space.sm, paddingVertical: space.sm, borderRadius: radius.md },
  pressed: { opacity: 0.6 },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    color: theme.colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
}))
