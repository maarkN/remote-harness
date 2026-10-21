import { Stack, usePathname } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useConnectionStore } from '@/core/connection'
import { useWidthClass } from '@/core/layout'
import { selectPendingCounts, usePermissionsStore } from '@/features/permissions/store'
import { UnreachableEmptyState } from '@/features/sessions/components/UnreachableEmptyState'
import { SessionsScreen } from '@/features/sessions/SessionsScreen'
import { EmptyState, Text } from '@/ui'

export default function SessionsRoute() {
  const { t } = useTranslation()
  const pending = usePermissionsStore(useShallow(selectPendingCounts))
  const widthClass = useWidthClass()
  const connectionStatus = useConnectionStore((s) => s.status)
  const unreachable = useConnectionStore((s) => s.unreachable)
  // The stack keeps the list mounted under a session: the arrows only move it while it is shown.
  const visible = usePathname() === '/'
  // In regular width the list is already visible in the master pane; this route is the detail pane.
  if (widthClass === 'regular') {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        {connectionStatus === 'reconnecting' && unreachable ? (
          <UnreachableEmptyState />
        ) : (
          <EmptyState title={t('sessions.detailEmptyTitle')}>
            <Text color="textMuted">{t('sessions.detailEmptyBody')}</Text>
          </EmptyState>
        )}
      </>
    )
  }
  return (
    <>
      {/* The list draws its own title row, which collapses with its header on scroll (#307). */}
      <Stack.Screen options={{ headerShown: false }} />
      <SessionsScreen pendingBySession={pending} interactive={visible} fab />
    </>
  )
}
