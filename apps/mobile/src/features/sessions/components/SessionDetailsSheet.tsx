import type { Profile, Session } from '@remote-harness/protocol'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { makeStyles, radius, space } from '@/core/theme'
import { Button, Text } from '@/ui'
import { SessionDetailsList } from './SessionDetailsList'

/** Bottom sheet with everything the app knows about a session (the same rows as the tablet inspector). */
export function SessionDetailsSheet({
  visible,
  session,
  profile,
  onClose,
}: {
  visible: boolean
  session: Session
  profile: Profile | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const styles = useStyles()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* A sibling behind the sheet, not its parent: a Pressable around the sheet would take the drag from the ScrollView. */}
        <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <Text weight="bold" accessibilityRole="header">
            {t('sessionDetails.title')}
          </Text>
          <Text size="sm" color="textMuted" selectable>
            {session.title || t('common.session')}
          </Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.content}>
            <SessionDetailsList sessionId={session.id} profile={profile} />
          </ScrollView>
          <Button label={t('common.close')} variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles((theme) => ({
  backdrop: { flex: 1, backgroundColor: theme.colors.backdrop, justifyContent: 'flex-end' },
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
  content: { paddingVertical: space.sm },
}))
