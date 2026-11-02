import type { Schedule, ScheduleTarget } from '@remote-harness/protocol'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { makeStyles, radius, space } from '@/core/theme'
import { Text } from '@/ui'
import { ScheduleEditorForm } from './ScheduleEditorForm'

/** The schedule editor in a sheet: a new schedule (`schedule` null) or an existing one. Mount it to show it. */
export function ScheduleEditorSheet({
  schedule,
  preset,
  onClose,
}: {
  schedule: Schedule | null
  preset?: { target?: ScheduleTarget | null }
  onClose: () => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const styles = useStyles()
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <Text weight="bold" accessibilityRole="header">
            {schedule ? t('schedules.edit') : t('schedules.new')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <ScheduleEditorForm schedule={schedule} preset={preset} onDone={onClose} onCancel={onClose} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const useStyles = makeStyles((theme) => ({
  backdrop: { flex: 1, backgroundColor: theme.colors.backdrop, justifyContent: 'flex-end' },
  fill: { flex: 1 },
  sheet: {
    maxHeight: '90%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    gap: space.sm,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  content: { paddingVertical: space.sm },
}))
