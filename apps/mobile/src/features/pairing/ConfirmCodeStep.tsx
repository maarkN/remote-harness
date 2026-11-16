import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TextInput, View } from 'react-native'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { Button, Card, Text } from '@/ui'

/**
 * After scanning (ADR-0009): the computer now shows a six-digit confirmation code, typed here to
 * complete the pairing. `machine` is the computer's name from the code.
 */
export function ConfirmCodeStep(props: {
  machine: string
  busy: boolean
  error: string | null
  onSubmit: (digits: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const [digits, setDigits] = useState('')
  const names = props.machine ? { machine: props.machine } : {}
  const submit = () => props.onSubmit(digits)
  return (
    <View style={styles.gap}>
      <Text size="xl" weight="bold" accessibilityRole="header">
        <Text size="xl" weight="bold" color="accentText">
          {'> '}
        </Text>
        {t('pairing.confirm.title', names)}
      </Text>
      <Text color="textMuted">{t('pairing.confirm.body', names)}</Text>
      <View style={styles.field}>
        <Text size="xs" color="textMuted">
          {t('pairing.confirm.label')}
        </Text>
        <TextInput
          value={digits}
          onChangeText={setDigits}
          accessibilityLabel={t('pairing.confirm.label')}
          placeholder="000 000"
          placeholderTextColor={colors.textDim}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={7}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          editable={!props.busy}
          style={styles.input}
        />
      </View>
      {props.error ? (
        <Card accent={colors.danger}>
          <Text color="danger">{props.error}</Text>
        </Card>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={t('pairing.confirm.cancel')}
          variant="ghost"
          onPress={props.onCancel}
          disabled={props.busy}
        />
        <Button label={t('pairing.confirm.submit')} variant="primary" onPress={submit} loading={props.busy} />
      </View>
    </View>
  )
}

const useStyles = makeStyles((theme) => ({
  gap: { gap: space.lg },
  field: { gap: space.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: theme.colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSize.xl,
    letterSpacing: 4,
    textAlign: 'center',
  },
}))
