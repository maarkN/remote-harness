import type { PairedDeviceInfo } from '@remote-harness/protocol'
import type { Messages } from '../../core/i18n/index.ts'
import { renderTable } from '../../core/text-table.ts'

/** A paired device as `devices list` reads it, from the daemon or from the file. */
type ListedDevice = Omit<PairedDeviceInfo, 'current'>

/** Shown for what a device never sent (its name, platform or app version). */
const UNKNOWN = '—'

/** `YYYY-MM-DD HH:MM` of an ISO time, as `devices list` has always shown it. */
export const shortTime = (iso: string): string => iso.slice(0, 16).replace('T', ' ')

/** Most recently seen first; devices never seen last, the newest pairing first. */
function byLastSeen(a: ListedDevice, b: ListedDevice): number {
  if (a.lastSeen && b.lastSeen) return b.lastSeen.localeCompare(a.lastSeen)
  if (a.lastSeen || b.lastSeen) return a.lastSeen ? -1 : 1
  return b.pairedAt.localeCompare(a.pairedAt)
}

/** `remote-harness devices list`: a header row and one aligned row per paired device (#618). */
export function devicesTable(devices: readonly ListedDevice[], labels: Messages['cli']['devices']): string[] {
  const c = labels.columns
  return renderTable(
    [c.id, c.name, c.platform, c.paired, c.seen, c.app],
    [...devices]
      .sort(byLastSeen)
      .map((d) => [
        d.id,
        d.name || UNKNOWN,
        d.platform || UNKNOWN,
        shortTime(d.pairedAt),
        d.lastSeen ? shortTime(d.lastSeen) : labels.never,
        d.app?.version ?? UNKNOWN,
      ]),
  )
}
