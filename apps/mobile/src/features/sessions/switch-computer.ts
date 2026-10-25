import { useConnectionStore } from '@/core/connection'

/**
 * Makes a paired computer active (a notification or a live status card from it was tapped); a
 * no-op for the active one, an unknown ID or none.
 */
export async function switchToComputer(daemonId: string | undefined): Promise<void> {
  if (!daemonId) return
  const { activeId, computers, selectComputer } = useConnectionStore.getState()
  if (daemonId === activeId || !computers.some((c) => c.daemonId === daemonId)) return
  await selectComputer(daemonId)
}
