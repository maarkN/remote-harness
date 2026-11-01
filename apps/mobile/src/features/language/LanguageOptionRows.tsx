import { Check } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import type { LanguagePreference } from '@/core/i18n/preference'
import { radius, space, useTheme } from '@/core/theme'
import { Text } from '@/ui'
import type { LanguageOption } from './options'

/** The radio rows of the language pickers (first launch and Settings → Language). */
export function LanguageOptionRows({
  rows,
  onPick,
}: {
  rows: LanguageOption[]
  onPick: (choice: LanguagePreference) => void
}) {
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <LanguageOptionRow key={row.choice} row={row} onPress={() => onPick(row.choice)} />
      ))}
    </View>
  )
}

function LanguageOptionRow({ row, onPress }: { row: LanguageOption; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: row.selected }}
      accessibilityLabel={row.hint ? `${row.label} · ${row.hint}` : row.label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.flex}>
        <Text weight={row.selected ? 'bold' : 'regular'}>{row.label}</Text>
        {row.hint ? (
          <Text size="xs" color="textMuted">
            {row.hint}
          </Text>
        ) : null}
      </View>
      {row.selected ? <Check size={18} color={colors.accentText} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 44,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
  },
})
