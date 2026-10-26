import Constants from 'expo-constants'
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { space } from '@/core/theme'
import { DaemonUpdateCard } from '@/features/daemon-update/DaemonUpdateCard'
import { DemoCard } from '@/features/demo/components/DemoCard'
import { Screen, Text } from '@/ui'
import { AppearanceCard } from './AppearanceCard'
import { AppIconCard } from './AppIconCard'
import { ComputersCard } from './ComputersCard'
import { DevicesCard } from './DevicesCard'
import { KeyboardCard } from './KeyboardCard'
import { MachineCard } from './MachineCard'
import { NewSessionCard } from './NewSessionCard'
import { NotificationsCard } from './NotificationsCard'
import { PermissionsCard } from './PermissionsCard'
import { ProfilesCard } from './ProfilesCard'

/**
 * Machine → Computers → Devices → Appearance → App icon → Profiles → New session → Notifications →
 * Permissions → Computer → the route's cards (Voice, App). In the offline demo the Demo card takes the
 * place of Computers, and Notifications is left out (the demo never pushes).
 */
export function SettingsScreen({ children }: { children?: ReactNode }) {
  const demo = useConnectionStore((s) => s.demo)
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <DemoCard />
        <MachineCard />
        {demo ? null : <ComputersCard />}
        <DevicesCard />
        <AppearanceCard />
        <AppIconCard />
        <ProfilesCard />
        <NewSessionCard />
        <KeyboardCard />
        {demo ? null : <NotificationsCard />}
        <PermissionsCard />
        <DaemonUpdateCard />
        {children}
        <Text size="xs" color="textDim" style={styles.center}>
          Remote Harness {Constants.expoConfig?.version ?? ''}
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  center: { textAlign: 'center' },
})
