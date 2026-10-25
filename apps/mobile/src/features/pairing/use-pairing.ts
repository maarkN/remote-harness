import type { PairingCode } from '@remote-harness/protocol'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { noiseCrypto } from '@/core/crypto'
import { computerFromCode } from '@/core/storage/computer'
import { credentialsStorage } from '@/core/storage/credentials'
import { deviceInfo } from './parse-pairing-url'
import { testConnection } from './test-connection'

/** Pairs with a code: a new key for this device, the Noise pairing, then saves the computer. */
export function usePairing() {
  const setCredentials = useConnectionStore((s) => s.setCredentials)
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pair = useCallback(
    async (code: PairingCode) => {
      setBusy(true)
      setError(null)
      const deviceKey = noiseCrypto.generateKeyPair()
      const result = await testConnection(code, {
        crypto: noiseCrypto,
        deviceKey,
        info: deviceInfo(Platform.OS, Platform.OS === 'ios' && Platform.isPad),
      })
      if (!result.ok) {
        const message = t(`pairing.errors.${result.error}`)
        setError(result.detail ? `${message} (${result.detail})` : message)
        setBusy(false)
        return false
      }
      const computer = computerFromCode(code, deviceKey)
      await credentialsStorage.save(computer)
      setCredentials(computer)
      setBusy(false)
      router.replace('/')
      return true
    },
    [setCredentials, t],
  )

  return { pair, busy, error, setError }
}
