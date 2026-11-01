import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FlatList,
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
import { Button, Text } from '@/ui'
import {
  builtinValues,
  fillTemplate,
  missingPlaceholders,
  type PromptTemplate,
  placeholdersOf,
  type TemplateContext,
  templatePreview,
} from './logic'
import { useTemplatesStore } from './store'
import { TemplateEditorForm } from './TemplateEditorForm'

type Mode =
  | { kind: 'list' }
  /** A picked template whose placeholders the context does not all fill. */
  | { kind: 'fill'; template: PromptTemplate; names: string[]; values: Record<string, string> }
  /** A new template, from the current prompt or from scratch. */
  | { kind: 'edit'; text: string }

/**
 * Picker of the saved templates. Tapping one inserts its text at once when the context fills every
 * placeholder, else after a small form; the sheet also saves the current prompt as a template and
 * opens the management screen. It only inserts into the draft: nothing is sent.
 */
export function TemplatesSheet({
  visible,
  context,
  currentText = '',
  onPick,
  onClose,
}: {
  visible: boolean
  context: TemplateContext
  /** What the composer holds now: offered as a new template. */
  currentText?: string
  onPick: (text: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useStyles()
  const templates = useTemplatesStore((s) => s.templates)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })

  const close = () => {
    setMode({ kind: 'list' })
    onClose()
  }
  const finish = (text: string) => {
    onPick(text)
    close()
  }
  const pick = (template: PromptTemplate) => {
    const values = builtinValues(context)
    if (missingPlaceholders(template.text, values).length === 0) {
      finish(fillTemplate(template.text, values))
      return
    }
    const names = placeholdersOf(template.text)
    setMode({
      kind: 'fill',
      template,
      names,
      values: Object.fromEntries(names.map((name) => [name, values[name] ?? ''])),
    })
  }
  const manage = () => {
    close()
    router.push('/templates')
  }
  const backToList = () => setMode({ kind: 'list' })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.fill} onPress={close} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          {mode.kind === 'list' ? (
            <>
              <Text weight="bold" accessibilityRole="header">
                {t('templates.title')}
              </Text>
              <Text size="xs" color="textMuted">
                {templates.length > 0 ? t('templates.hint') : t('templates.empty')}
              </Text>
              <FlatList
                data={templates}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => pick(item)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Text weight="medium" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text size="xs" color="textMuted" numberOfLines={2}>
                      {templatePreview(item.text)}
                    </Text>
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text size="sm" color="textDim" style={styles.emptyHint}>
                    {t('templates.emptyHint')}
                  </Text>
                }
              />
              <View style={styles.actions}>
                {currentText.trim() ? (
                  <Button
                    label={t('templates.saveCurrent')}
                    onPress={() => setMode({ kind: 'edit', text: currentText })}
                    flex
                  />
                ) : null}
                {templates.length > 0 ? (
                  <Button label={t('templates.manage')} onPress={manage} flex />
                ) : (
                  <Button
                    label={t('templates.new')}
                    onPress={() => setMode({ kind: 'edit', text: '' })}
                    flex
                  />
                )}
              </View>
              <Button label={t('common.close')} variant="ghost" onPress={close} />
            </>
          ) : mode.kind === 'fill' ? (
            <>
              <Text weight="bold" accessibilityRole="header">
                {mode.template.title}
              </Text>
              <Text size="xs" color="textMuted">
                {t('templates.fillTitle')}
              </Text>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}
                style={styles.list}
              >
                {mode.names.map((name) => (
                  <View key={name} style={styles.field}>
                    <Text size="xs" color="textMuted">
                      {`{${name}}`}
                    </Text>
                    <TextInput
                      value={mode.values[name] ?? ''}
                      onChangeText={(value) =>
                        setMode({ ...mode, values: { ...mode.values, [name]: value } })
                      }
                      placeholderTextColor={colors.textDim}
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel={name}
                      style={styles.input}
                    />
                  </View>
                ))}
              </ScrollView>
              <View style={styles.actions}>
                <Button label={t('common.cancel')} variant="ghost" onPress={backToList} flex />
                <Button
                  label={t('templates.insert')}
                  variant="primary"
                  onPress={() => finish(fillTemplate(mode.template.text, mode.values))}
                  flex
                />
              </View>
            </>
          ) : (
            <>
              <Text weight="bold" accessibilityRole="header">
                {t('templates.new')}
              </Text>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}
                style={styles.list}
              >
                <TemplateEditorForm
                  template={null}
                  initialText={mode.text}
                  onDone={backToList}
                  onCancel={backToList}
                />
              </ScrollView>
            </>
          )}
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
  list: { flexGrow: 0 },
  content: { gap: space.sm, paddingVertical: space.sm },
  row: {
    gap: 2,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
  },
  pressed: { borderColor: theme.colors.accent },
  emptyHint: { textAlign: 'center', padding: space.md },
  actions: { flexDirection: 'row', gap: space.sm },
  field: { gap: 4 },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    color: theme.colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
  },
}))
