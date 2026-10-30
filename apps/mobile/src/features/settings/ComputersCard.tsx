import { router } from 'expo-router'
import { Check, Pencil, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { computerName, useConnectionStore } from '@/core/connection'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { Button, Card, IconButton, Text } from '@/ui'
import { clearCommandRecents } from '../autocomplete/recents-store'
import { clearAllDrafts } from '../drafts/persistence'

/** Settings → Computers: every paired computer, switch, rename on this device, forget, add another. */
export function ComputersCard() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const computers = useConnectionStore((s) => s.computers)
  const activeId = useConnectionStore((s) => s.activeId)
  const selectComputer = useConnectionStore((s) => s.selectComputer)
  const forgetComputer = useConnectionStore((s) => s.forgetComputer)
  const renameComputer = useConnectionStore((s) => s.renameComputer)
  const [renaming, setRenaming] = useState<{ id: string; draft: string; placeholder: string } | null>(null)

  const forget = (daemonId: string, name: string) => {
    Alert.alert(t('computers.forgetTitle', { name }), t('computers.forgetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.forget'),
        style: 'destructive',
        onPress: async () => {
          const last = useConnectionStore.getState().computers.length <= 1
          await forgetComputer(daemonId)
          // Drafts and recents are not kept per computer: they go with the last one.
          if (last) {
            await clearAllDrafts()
            await clearCommandRecents()
            router.replace('/pair')
          }
        },
      },
    ])
  }

  return (
    <Card>
      <View style={layout.gap}>
        <Text weight="bold">{t('computers.title')}</Text>
        {computers.map((computer) => {
          const name = computerName(computer)
          const active = computer.daemonId === activeId
          return (
            <View key={computer.daemonId} style={layout.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t('computers.switchLabel', { name })}
                onPress={() => void selectComputer(computer.daemonId)}
                style={layout.name}
              >
                {active ? <Check size={16} color={colors.accentText} /> : <View style={layout.check} />}
                <Text numberOfLines={1} color={active ? 'accentText' : 'text'} style={layout.flex}>
                  {name}
                </Text>
              </Pressable>
              <IconButton
                icon={Pencil}
                size={16}
                label={t('settings.editName')}
                onPress={() =>
                  setRenaming({
                    id: computer.daemonId,
                    draft: computer.alias ?? '',
                    placeholder: computer.name,
                  })
                }
              />
              <IconButton
                icon={Trash2}
                size={16}
                label={t('settings.forget')}
                onPress={() => forget(computer.daemonId, name)}
              />
            </View>
          )
        })}
        <Button label={t('computers.add')} compact onPress={() => router.push('/pair')} />
      </View>
      <RenameSheet
        value={renaming}
        onChange={(draft) => setRenaming((r) => (r ? { ...r, draft } : r))}
        onClose={() => setRenaming(null)}
        onSave={() => {
          if (renaming) void renameComputer(renaming.id, renaming.draft)
          setRenaming(null)
        }}
      />
    </Card>
  )
}

function RenameSheet(props: {
  value: { draft: string; placeholder: string } | null
  onChange: (draft: string) => void
  onClose: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={props.value !== null} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <Text weight="bold" accessibilityRole="header">
            {t('settings.nameTitle')}
          </Text>
          <Text size="xs" color="textMuted">
            {t('settings.nameHint', { host: props.value?.placeholder ?? '—' })}
          </Text>
          <TextInput
            value={props.value?.draft ?? ''}
            onChangeText={props.onChange}
            autoFocus
            autoCorrect={false}
            placeholder={props.value?.placeholder ?? ''}
            placeholderTextColor={colors.textDim}
            style={styles.input}
          />
          <View style={layout.actions}>
            <Button label={t('common.cancel')} variant="ghost" onPress={props.onClose} />
            <Button label={t('settings.save')} variant="primary" onPress={props.onSave} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const layout = StyleSheet.create({
  gap: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  name: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  check: { width: 16 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
})

const useStyles = makeStyles((theme) => ({
  backdrop: { flex: 1, backgroundColor: theme.colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
  },
}))
