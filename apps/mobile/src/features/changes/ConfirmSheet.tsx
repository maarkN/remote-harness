import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { makeStyles, radius, space } from '@/core/theme'
import { Button, Text } from '@/ui'

/** A bottom sheet that shows what an action will do before it runs. */
export function ConfirmSheet({
  visible,
  title,
  confirmLabel,
  confirmDisabled,
  busy,
  onConfirm,
  onClose,
  children,
}: {
  visible: boolean
  title: string
  confirmLabel: string
  confirmDisabled?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <Text weight="bold" accessibilityRole="header">
            {title}
          </Text>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <View style={styles.actions}>
            <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
            <Button
              label={busy ? t('changes.working') : confirmLabel}
              variant="primary"
              disabled={confirmDisabled || busy}
              onPress={onConfirm}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** A label and value line of a confirmation (branch, remote). */
export function ConfirmRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles()
  return (
    <View style={styles.row}>
      <Text size="xs" color="textMuted">
        {label}
      </Text>
      <Text size="sm" selectable numberOfLines={2} style={styles.flex}>
        {value}
      </Text>
    </View>
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
  body: { gap: space.sm, paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  flex: { flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, paddingTop: space.sm },
}))
