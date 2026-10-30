import * as SecureStore from 'expo-secure-store'
import { useEffect } from 'react'
import { useConnectionStore } from '@/core/connection'
import { resolveMachineName, setMachineName } from '@/core/i18n/machine'

/** The alias of the version with a single computer; moved onto the active computer once. */
const LEGACY_ALIAS_KEY = 'remote-harness.machine-alias'

/** Moves the old single alias onto the active computer; called once at app start. */
export async function restoreMachineAlias(): Promise<void> {
  const saved = (await SecureStore.getItemAsync(LEGACY_ALIAS_KEY).catch(() => null))?.trim()
  if (!saved) return
  const { activeId, credentials, renameComputer } = useConnectionStore.getState()
  if (!activeId || credentials?.alias) return
  await renameComputer(activeId, saved)
  await SecureStore.deleteItemAsync(LEGACY_ALIAS_KEY).catch(() => undefined)
}

/** Renames the active computer on this device (null: back to the host name). */
export async function setMachineAlias(alias: string | null): Promise<void> {
  const { activeId, renameComputer } = useConnectionStore.getState()
  if (activeId) await renameComputer(activeId, alias)
}

/** The active computer's alias, else the host name from the daemon's handshake, else its paired name. */
export function useMachineName(): string | null {
  const alias = useConnectionStore((s) => s.credentials?.alias ?? null)
  const host = useConnectionStore((s) => s.hello?.host)
  const paired = useConnectionStore((s) => s.credentials?.name ?? null)
  return resolveMachineName(alias, host) ?? resolveMachineName(paired, null)
}

/** The active computer's alias (null when it has none). */
export function useMachineAlias(): string | null {
  return useConnectionStore((s) => s.credentials?.alias ?? null)
}

/** Keeps the catalogs' `{{machine}}` in step with the connection and the alias (root layout). */
export function useMachineNameSync(): void {
  const name = useMachineName()
  useEffect(() => {
    setMachineName(name)
  }, [name])
}
