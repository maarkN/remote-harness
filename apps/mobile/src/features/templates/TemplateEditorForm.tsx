import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, TextInput, View } from 'react-native'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { Button, Text } from '@/ui'
import { cleanTitle, MAX_TEMPLATE_CHARS, MAX_TEMPLATE_TITLE, type PromptTemplate } from './logic'
import { deleteTemplate, saveTemplate } from './store'

/**
 * Title and text of a template, with the placeholder hint. Save stays disabled while either is blank
 * or the text is over the limit; Delete (existing templates) asks first. Used inline by the picker
 * and inside its own sheet by the management screen.
 */
export function TemplateEditorForm({
  template,
  initialText = '',
  onDone,
  onCancel,
}: {
  template: PromptTemplate | null
  /** Text of a new template (the current prompt, from the picker). */
  initialText?: string
  /** Saved or deleted. */
  onDone: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const [title, setTitle] = useState(template?.title ?? '')
  const [text, setText] = useState(template?.text ?? initialText)
  const cleaned = cleanTitle(title)
  const tooLong = text.length > MAX_TEMPLATE_CHARS
  const canSave = cleaned.length > 0 && text.trim().length > 0 && !tooLong

  const save = () => {
    if (!canSave) return
    saveTemplate({ ...(template ? { id: template.id } : {}), title: cleaned, text: text.trim() })
    onDone()
  }

  const confirmDelete = () => {
    if (!template) return
    Alert.alert(t('templates.deleteTitle'), t('templates.deleteBody', { title: template.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('templates.delete'),
        style: 'destructive',
        onPress: () => {
          deleteTemplate(template.id)
          onDone()
        },
      },
    ])
  }

  return (
    <View style={styles.form}>
      <Text size="xs" color="textMuted">
        {t('templates.titleLabel')}
      </Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t('templates.titlePlaceholder')}
        placeholderTextColor={colors.textDim}
        maxLength={MAX_TEMPLATE_TITLE}
        returnKeyType="done"
        accessibilityLabel={t('templates.titleLabel')}
        style={styles.input}
      />
      <Text size="xs" color="textMuted">
        {t('templates.textLabel')}
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('templates.textPlaceholder')}
        placeholderTextColor={colors.textDim}
        multiline
        accessibilityLabel={t('templates.textLabel')}
        style={[styles.input, styles.multiline]}
      />
      <Text size="xs" color={tooLong ? 'danger' : 'textDim'}>
        {tooLong ? t('templates.tooLong', { max: MAX_TEMPLATE_CHARS }) : t('templates.placeholdersHint')}
      </Text>
      <View style={styles.actions}>
        {template ? <Button label={t('templates.delete')} variant="danger" onPress={confirmDelete} /> : null}
        <View style={styles.flex} />
        <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        <Button label={t('templates.save')} variant="primary" disabled={!canSave} onPress={save} />
      </View>
    </View>
  )
}

const useStyles = makeStyles((theme) => ({
  form: { gap: space.sm },
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
  // Five lines of room; grows with the text.
  multiline: { minHeight: 132, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.xs },
  flex: { flex: 1 },
}))
