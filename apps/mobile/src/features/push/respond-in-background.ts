import type { ClientRequest } from '@remote-harness/protocol'
import { withShortLivedClient } from '@/core/connection/short-lived'

/** Sends one request from a notification action with a short-lived connection to its computer. */
export function sendInBackground(request: ClientRequest, daemonId?: string): Promise<boolean> {
  return withShortLivedClient((client) => client.request(request), daemonId)
}

/** Answers a permission from a notification action with a short-lived connection to its computer. */
export function respondInBackground(
  requestId: string,
  decision: 'allow' | 'deny',
  daemonId?: string,
): Promise<boolean> {
  return withShortLivedClient(
    (client) => client.request({ type: 'permission.respond', requestId, decision }),
    daemonId,
  )
}
