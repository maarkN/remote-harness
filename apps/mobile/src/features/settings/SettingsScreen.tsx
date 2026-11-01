import Constants from 'expo-constants'
import { router } from 'expo-router'
import {
  Bell,
  ChevronRight,
  Info,
  type LucideIcon,
  Mic,
  Monitor,
  Palette,
  ShieldCheck,
  Smartphone,
  SquareTerminal,
  Users,
} from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { selectProfiles, useConnectionStore } from '@/core/connection'
import { currentAppLocale, useLanguageStore } from '@/core/i18n'
import { makeStyles, radius, space, useTheme, useThemeStore } from '@/core/theme'
import { useUpdatesStore } from '@/core/updates'
import { useReturnKeySettings } from '@/features/conversation/return-key-store'
import { profileAgent } from '@/features/lifecycle/new-session'
import { useOpenAfterCreateSettings } from '@/features/lifecycle/open-after-create-store'
import { useLiveStatusSettings } from '@/features/live-status/settings-store'
import { useMuteStore } from '@/features/mute/store'
import { usePushSettings } from '@/features/push/push-settings-store'
import { useTemplatesStore } from '@/features/templates/store'
import { useVoiceLanguageStore } from '@/features/voice/voice-language-store'
import { Screen, Text } from '@/ui'
import { useAppIconStore } from './app-icon-store'
import { useMachineName } from './machine-store'
import { type SettingsSectionKey, settingsSections } from './sections'

const ICONS: Record<SettingsSectionKey, LucideIcon> = {
  computer: Monitor,
  devices: Smartphone,
  appearance: Palette,
  profiles: Users,
  sessions: SquareTerminal,
  notifications: Bell,
  permissions: ShieldCheck,
  voice: Mic,
  app: Info,
}

/**
 * Settings: nine sections on one screen, each row summarizing the section's current state and
 * opening its own screen (Permissions opens the Permissions screen directly; see `SettingsSections`).
 * The demo has no Notifications row. The app version sits under the list.
 */
export function SettingsScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const demo = useConnectionStore((s) => s.demo)
  const status = useConnectionStore((s) => s.status)
  const name = useMachineName()
  const theme = useThemeStore((s) => s.preference)
  const system = useThemeStore((s) => s.system)
  const icon = useAppIconStore((s) => s.preference)
  const profiles = useConnectionStore(selectProfiles)
  const openAfterCreate = useOpenAfterCreateSettings((s) => s.enabled)
  const returnSends = useReturnKeySettings((s) => s.sends)
  const templates = useTemplatesStore((s) => s.templates.length)
  const push = usePushSettings((s) => s.enabled)
  const live = useLiveStatusSettings((s) => s.enabled)
  const muted = useMuteStore((s) => s.profiles.length + s.sessions.length)
  const voice = useVoiceLanguageStore((s) => s.language)
  const channel = useUpdatesStore((s) => s.channel)
  const locale = useLanguageStore((s) => currentAppLocale(s.preference))
  const version = Constants.expoConfig?.version ?? ''
  const sections = settingsSections(
    {
      demo,
      computer: { name, status },
      appearance: { theme, system, icon },
      profiles: profiles.map((profile) => profileAgent(profile)),
      sessions: { openAfterCreate, returnSends, templates },
      notifications: { push, live, muted },
      voice,
      app: { version, channel, locale },
    },
    t,
  )
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.list}>
          {sections.map((section, index) => {
            const Icon = ICONS[section.key]
            return (
              <Pressable
                key={section.key}
                accessibilityRole="button"
                accessibilityLabel={section.title}
                accessibilityHint={section.summary}
                onPress={() => router.push(section.route)}
                style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}
              >
                <View style={styles.icon}>
                  <Icon size={18} color={colors.accentText} />
                </View>
                <View style={styles.flex}>
                  <Text weight="medium">{section.title}</Text>
                  <Text size="xs" color="textMuted" numberOfLines={1}>
                    {section.summary}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.textDim} />
              </Pressable>
            )
          })}
        </View>
        <Text size="xs" color="textDim" style={styles.center}>
          Remote Harness {version}
        </Text>
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles((theme) => ({
  content: { padding: space.lg, gap: space.md },
  list: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  pressed: { backgroundColor: theme.colors.surfaceRaised },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
  },
  flex: { flex: 1, gap: 1 },
  center: { textAlign: 'center' },
}))
