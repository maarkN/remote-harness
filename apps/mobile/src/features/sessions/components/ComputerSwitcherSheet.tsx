import { router } from 'expo-router'
import { Check, Monitor, Plus } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { computerName, useConnectionStore } from '@/core/connection'
import { makeStyles, radius, space, useTheme } from '@/core/theme'
import { Button, Text } from '@/ui'

/** The paired computers: pick the one to connect to, or add another (the pairing screen). */
export function ComputerSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const paired = useConnectionStore((s) => s.computers)
  const computers = paired.map((c) => ({ id: c.daemonId, name: computerName(c) }))
  const activeId = useConnectionStore((s) => s.activeId)
  const selectComputer = useConnectionStore((s) => s.selectComputer)
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <Text weight="bold" accessibilityRole="header" style={styles.header}>
            {t('computers.switchTitle')}
          </Text>
          {computers.map((computer) => {
            const active = computer.id === activeId
            return (
              <Pressable
                key={computer.id}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onClose()
                  void selectComputer(computer.id)
                }}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <Monitor size={18} color={active ? colors.accentText : colors.textMuted} />
                <Text color={active ? 'accentText' : 'text'} numberOfLines={1} style={styles.text}>
                  {computer.name}
                </Text>
                {active ? <Check size={18} color={colors.accentText} /> : null}
              </Pressable>
            )
          })}
          <Pressable
            accessibilityRole="menuitem"
            onPress={() => {
              onClose()
              router.push('/pair')
            }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Plus size={18} color={colors.textMuted} />
            <Text style={styles.text}>{t('computers.add')}</Text>
          </Pressable>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles((theme) => ({
  backdrop: { flex: 1, backgroundColor: theme.colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.xxs,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  header: { paddingBottom: space.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: theme.colors.surfaceRaised },
  text: { flex: 1 },
}))
