import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useConnectionStore } from '@/core/connection'

/** Tells the user once that another device revoked this one on a computer (that computer is gone). */
export function useRevokedNotice(): void {
  const { t } = useTranslation()
  const revokedFrom = useConnectionStore((s) => s.revokedFrom)
  useEffect(() => {
    if (!revokedFrom) return
    Alert.alert(t('computers.revokedTitle'), t('computers.revokedBody', { name: revokedFrom }))
    useConnectionStore.getState().dismissRevoked()
  }, [revokedFrom, t])
}
