import { useConnectionStore } from '@/core/connection'
import { ErrorReportsCard } from '@/features/error-reports/components/ErrorReportsCard'
import { PerformanceNumbersCard } from '@/features/performance/PerformanceNumbersCard'
import { AppUpdatesCard } from '@/features/settings/AppUpdatesCard'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { VoiceLanguageCard } from '@/features/voice/components/VoiceLanguageCard'

export default function SettingsRoute() {
  // Error reports and performance data stay off in the offline demo.
  const demo = useConnectionStore((s) => s.demo)
  return (
    <SettingsScreen>
      <VoiceLanguageCard />
      <AppUpdatesCard />
      {demo ? null : <ErrorReportsCard />}
      {demo ? null : <PerformanceNumbersCard />}
    </SettingsScreen>
  )
}
