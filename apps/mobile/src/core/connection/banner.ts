import { CHANNEL_CLOSE } from '@remote-harness/protocol'
import type { ConnectionStatus } from './daemon-client'

export type BannerKey = Exclude<ConnectionStatus, 'open' | 'idle'> | 'asleep' | 'incompatible'

/** Which `connection.banner.*` text describes a connection that is not open. */
export function bannerKey(
  status: Exclude<ConnectionStatus, 'open' | 'idle'>,
  unreachable: boolean,
  closeCode: number | undefined,
): BannerKey {
  // Refused for its protocol, or its `auth.ok` could not be read: pairing again would not help.
  if (status === 'unauthorized' && closeCode === CHANNEL_CLOSE.protocolMismatch) return 'incompatible'
  // No answer at all: likely a sleeping or offline computer rather than a network blip.
  if (status === 'reconnecting' && unreachable) return 'asleep'
  return status
}
