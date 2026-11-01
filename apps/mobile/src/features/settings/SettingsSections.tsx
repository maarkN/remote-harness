import type { ReactNode } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { space } from '@/core/theme'
import { DaemonUpdateCard } from '@/features/daemon-update/DaemonUpdateCard'
import { DemoCard } from '@/features/demo/components/DemoCard'
import { ErrorReportsCard } from '@/features/error-reports/components/ErrorReportsCard'
import { LanguageCard } from '@/features/language/LanguageCard'
import { PerformanceNumbersCard } from '@/features/performance/PerformanceNumbersCard'
import { VoiceLanguageCard } from '@/features/voice/components/VoiceLanguageCard'
import { Screen } from '@/ui'
import { AppearanceCard } from './AppearanceCard'
import { AppIconCard } from './AppIconCard'
import { AppUpdatesCard } from './AppUpdatesCard'
import { ComputersCard } from './ComputersCard'
import { DevicesCard } from './DevicesCard'
import { KeyboardCard } from './KeyboardCard'
import { MachineCard } from './MachineCard'
import { NewSessionCard } from './NewSessionCard'
import { NotificationsCard } from './NotificationsCard'
import { ProfilesCard } from './ProfilesCard'
import { TemplatesCard } from './TemplatesCard'

/** One section of Settings: its cards in a scrolling column, under the section's title in the header. */
export function SettingsSectionScreen({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </Screen>
  )
}

/** Settings → Computer: the paired computer, the other computers (the Demo card in the demo) and its update. */
export function ComputerSettings() {
  const demo = useConnectionStore((s) => s.demo)
  return (
    <SettingsSectionScreen>
      <DemoCard />
      <MachineCard />
      {demo ? null : <ComputersCard />}
      <DaemonUpdateCard />
    </SettingsSectionScreen>
  )
}

/** Settings → Devices: the phones and tablets paired with the computer. */
export function DevicesSettings() {
  return (
    <SettingsSectionScreen>
      <DevicesCard />
    </SettingsSectionScreen>
  )
}

/** Settings → Appearance: theme and list density, then the app icon. */
export function AppearanceSettings() {
  return (
    <SettingsSectionScreen>
      <AppearanceCard />
      <AppIconCard />
    </SettingsSectionScreen>
  )
}

/** Settings → Profiles. */
export function ProfilesSettings() {
  return (
    <SettingsSectionScreen>
      <ProfilesCard />
    </SettingsSectionScreen>
  )
}

/** Settings → Sessions: New session defaults, prompt templates and the keyboard. */
export function SessionsSettings() {
  return (
    <SettingsSectionScreen>
      <NewSessionCard />
      <TemplatesCard />
      <KeyboardCard />
    </SettingsSectionScreen>
  )
}

/** Settings → Notifications (not offered in the demo, which never pushes). */
export function NotificationsSettings() {
  return (
    <SettingsSectionScreen>
      <NotificationsCard />
    </SettingsSectionScreen>
  )
}

/** Settings → Voice: dictation. */
export function VoiceSettings() {
  return (
    <SettingsSectionScreen>
      <VoiceLanguageCard />
    </SettingsSectionScreen>
  )
}

/** Settings → App: updates and channel, language, error reports and performance (the last two not in the demo). */
export function AppSettings() {
  const demo = useConnectionStore((s) => s.demo)
  return (
    <SettingsSectionScreen>
      <AppUpdatesCard />
      <LanguageCard />
      {demo ? null : <ErrorReportsCard />}
      {demo ? null : <PerformanceNumbersCard />}
    </SettingsSectionScreen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
})
