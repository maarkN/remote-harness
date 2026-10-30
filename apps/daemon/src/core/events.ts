import type { AccountLimits, PermissionOutcome, PermissionRequestInfo } from '@remote-harness/protocol'
import type { HookEvent } from '../features/hooks/payloads.ts'

/** Domain events exchanged between features through the bus. Grows as features are added. */
export type DaemonEvents = {
  hook: HookEvent
  'permission.requested': PermissionRequestInfo
  /** `continued`: answered in the terminal and the turn went on (a tool result was read). */
  'permission.resolved': { info: PermissionRequestInfo; outcome: PermissionOutcome; continued?: boolean }
  /** The hook stopped waiting; the request is answered in the terminal until the session moves on. */
  'permission.handover': PermissionRequestInfo
  /** A question or plan is still open after a while. */
  'permission.reminder': PermissionRequestInfo
  /** Account limits a profile reported outside the status line (Codex rollouts). */
  'account.limits': Pick<AccountLimits, 'profileId' | 'fiveHour' | 'sevenDay'>
  /** A paired device was revoked (from a device or the CLI): its connections and push go with it. */
  'device.revoked': { deviceId: string }
  /** These FCM tokens no longer belong to a paired device: nothing may be sent to them. */
  'push.tokens.dropped': { tokens: string[] }
}
