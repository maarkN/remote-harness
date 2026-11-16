import { X } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { keys, useKeyCommand } from '@/core/keyboard/key-commands'
import { useWidthClass } from '@/core/layout'
import { makeStyles, radius, space } from '@/core/theme'
import { IconButton } from './IconButton'

/** Widest a sheet gets on tablets; it is centered there. */
const SHEET_MAX_WIDTH = 560

/**
 * Shared modal bottom sheet (#563): dimmed backdrop that closes it, Android back and Esc close it,
 * safe area at the bottom, rounded top, a header (`header`, or nothing) with a close button, the
 * content in a scroll view and an optional `footer` that stays below it. On regular width it is
 * centered and at most 560 pt wide.
 */
export function Sheet({
  visible,
  onClose,
  header,
  footer,
  children,
  accessibilityLabel,
}: {
  visible: boolean
  onClose: () => void
  /** Drawn left of the close button at the top. */
  header?: ReactNode
  /** Stays under the scrolling content (e.g. a destructive action set apart). */
  footer?: ReactNode
  children: ReactNode
  accessibilityLabel?: string
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const styles = useStyles()
  const regular = useWidthClass() === 'regular'
  useKeyCommand({ input: keys.keyInputEscape }, onClose, visible)
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* A sibling behind the sheet, not its parent: a Pressable around the sheet would take the drag from the ScrollView. */}
        <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={onClose} />
        <View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[styles.sheet, regular && styles.regular, { paddingBottom: insets.bottom + space.md }]}
        >
          <View style={styles.header}>
            <View style={styles.headerContent}>{header}</View>
            <IconButton icon={X} label={t('common.close')} onPress={onClose} />
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles((theme) => ({
  backdrop: { flex: 1, backgroundColor: theme.colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    paddingTop: space.lg,
  },
  regular: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingLeft: space.xl,
    paddingRight: space.md,
  },
  headerContent: { flex: 1, minWidth: 0 },
  body: { flexGrow: 0 },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm, gap: space.lg },
  footer: { paddingHorizontal: space.xl, paddingTop: space.sm },
}))
