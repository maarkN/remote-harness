import * as Haptics from 'expo-haptics'
import { Mic, Repeat2, X } from 'lucide-react-native'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { fontSize, makeStyles, radius, space, useTheme } from '@/core/theme'
import { Text } from '@/ui'
import type { Phase } from './engine'

type Props = {
  phase: Phase
  lastSaid: string
  onTalk(): void
  onRepeat(): void
  onExit(): void
}

/** Big targets: usable with gloves, on a bike mount or without looking closely. */
const TALK_HEIGHT = 72
const SECONDARY_HEIGHT = 56

/**
 * Replaces the composer while hands-free is on: the state, the last sentence spoken (large, so a
 * glance is enough) and three large controls. Colors come from the theme tokens.
 */
export function HandsFreeBar({ phase, lastSaid, onTalk, onRepeat, onExit }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const listening = phase === 'listening'
  const state = listening
    ? t('handsFree.state.listening')
    : phase === 'speaking'
      ? t('handsFree.state.speaking')
      : t('handsFree.state.idle')

  return (
    <View style={styles.bar}>
      <View accessibilityLiveRegion="polite" style={styles.status}>
        <Text size="sm" weight="medium" color={listening ? 'accentText' : 'textMuted'}>
          {state}
        </Text>
        {lastSaid ? (
          <Text style={styles.said} numberOfLines={3}>
            {lastSaid}
          </Text>
        ) : null}
      </View>
      <BigButton
        label={t('handsFree.talk')}
        hint={t('handsFree.talkHint')}
        icon={Mic}
        primary
        active={listening}
        height={TALK_HEIGHT}
        onPress={onTalk}
        iconColor={colors.accentInk}
      />
      <View style={styles.row}>
        <BigButton
          label={t('handsFree.repeat')}
          icon={Repeat2}
          height={SECONDARY_HEIGHT}
          onPress={onRepeat}
          iconColor={colors.text}
        />
        <BigButton
          label={t('handsFree.exit')}
          icon={X}
          height={SECONDARY_HEIGHT}
          onPress={onExit}
          iconColor={colors.text}
        />
      </View>
    </View>
  )
}

function BigButton({
  label,
  hint,
  icon: Icon,
  primary,
  active,
  height,
  onPress,
  iconColor,
}: {
  label: string
  hint?: string
  icon: ComponentType<{ size?: number; color?: string }>
  primary?: boolean
  active?: boolean
  height: number
  onPress(): void
  iconColor: string
}) {
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: active ?? false }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
        onPress()
      }}
      style={({ pressed }) => [
        styles.button,
        { minHeight: height },
        primary ? styles.primary : styles.secondary,
        active && styles.active,
        pressed && styles.pressed,
      ]}
    >
      <Icon size={primary ? 28 : 22} color={iconColor} />
      <Text
        weight="bold"
        color={primary ? 'accentInk' : 'text'}
        style={primary ? styles.primaryLabel : undefined}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const useStyles = makeStyles((theme) => ({
  bar: {
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  status: { gap: space.xs, minHeight: 44 },
  said: { fontSize: fontSize.lg, lineHeight: 24, color: theme.colors.text },
  row: { flexDirection: 'row', gap: space.sm },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  primary: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  secondary: { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong },
  active: { borderColor: theme.colors.text },
  pressed: { opacity: 0.75 },
  primaryLabel: { fontSize: fontSize.xl },
}))
