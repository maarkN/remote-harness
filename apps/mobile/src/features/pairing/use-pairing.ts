import { confirmationDigits, type KeyPair, type PairingCode } from '@remote-harness/protocol'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { noiseCrypto } from '@/core/crypto'
import { computerFromCode } from '@/core/storage/computer'
import { deviceInfo } from './parse-pairing-url'
import { announcePairing, type PairTarget, type TestFailure, testConnection } from './test-connection'

/** A code the computer accepted: it now shows the confirmation code this phone asks for. */
export type PendingPairing = { code: PairingCode; target: PairTarget; deviceKey: KeyPair }

/** Failures that end the pairing: back to scanning. The others keep the confirmation step open. */
const FINAL: ReadonlySet<TestFailure> = new Set([
  'confirmationLocked',
  'codeUsed',
  'deviceLimit',
  'wrongComputer',
])

/**
 * Pairs with a code in two steps (ADR-0009): `pair` presents the code, so the computer shows the
 * confirmation code; `confirm` pairs with the digits the user typed, then saves the computer.
 */
export function usePairing() {
  const addComputer = useConnectionStore((s) => s.addComputer)
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingPairing | null>(null)

  const message = useCallback(
    (code: PairingCode, failure: TestFailure, detail?: string) => {
      // The computer being paired, not the active one, when the code names it.
      const names = code.name ? { machine: code.name, Machine: code.name } : {}
      const text = t(`pairing.errors.${failure}`, names)
      return detail ? `${text} (${detail})` : text
    },
    [t],
  )

  const pair = useCallback(
    async (code: PairingCode) => {
      setBusy(true)
      setError(null)
      const result = await announcePairing(code, { crypto: noiseCrypto })
      setBusy(false)
      if (!result.ok) {
        setError(message(code, result.error, result.detail))
        return false
      }
      setPending({ code, target: result.target, deviceKey: noiseCrypto.generateKeyPair() })
      return true
    },
    [message],
  )

  const confirm = useCallback(
    async (typed: string) => {
      if (!pending) return false
      const digits = confirmationDigits(typed)
      if (!digits) {
        setError(t('pairing.confirm.invalid'))
        return false
      }
      setBusy(true)
      setError(null)
      const result = await testConnection(pending.code, {
        crypto: noiseCrypto,
        deviceKey: pending.deviceKey,
        info: deviceInfo(Platform.OS, Platform.OS === 'ios' && Platform.isPad),
        confirmation: digits,
        first: pending.target,
      })
      if (!result.ok) {
        setError(message(pending.code, result.error, result.detail))
        if (FINAL.has(result.error)) setPending(null)
        setBusy(false)
        return false
      }
      await addComputer(computerFromCode(pending.code, pending.deviceKey))
      setBusy(false)
      setPending(null)
      router.replace('/')
      return true
    },
    [addComputer, message, pending, t],
  )

  const cancel = useCallback(() => {
    setPending(null)
    setError(null)
  }, [])

  return { pair, confirm, cancel, pending, busy, error, setError }
}
