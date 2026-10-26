import type { PermissionRequestInfo, Profile, PushMode, PushTestResult } from '@remote-harness/protocol'
import type { Messages } from '../../core/i18n/index.ts'
import type { Logger } from '../../core/logger.ts'
import type { HookEvent } from '../hooks/payloads.ts'
import type { DeviceRegistry } from './devices.ts'
import type { PushMessage, PushSender } from './sender.ts'

export const PERMISSION_CATEGORY = 'PERMISSION'
/** Turn pushes: Reply, Reply by voice and Interrupt; `TURN_QUEUE` adds Send next queued. */
export const TURN_CATEGORY = 'TURN'
export const TURN_QUEUE_CATEGORY = 'TURN_QUEUE'

/** What the category of a turn push depends on. */
export type TurnInfo = { controllable: boolean; queued: number }

/** The actions a finished or waiting session's push offers: none for a read-only session. */
export function turnCategory(info: TurnInfo | null): string | null {
  if (!info?.controllable) return null
  return info.queued > 0 ? TURN_QUEUE_CATEGORY : TURN_CATEGORY
}

export type PushServiceOptions = {
  profiles: readonly Profile[]
  /** True when some app is connected and in the foreground: it shows the event itself. */
  hasForegroundClient: () => boolean
  isMuted: (profileId: string | null, sessionId: string) => boolean
  /** Texts in the configured language. Only titles: the body is the profile name. */
  messages: Messages['push']
  /** Current push mode (tests answer `off` instead of trying). */
  mode: () => PushMode
  /** Name of this computer, the body of test pushes. */
  host: string
  /** Added to every push so the app opens it on (and answers it from) the right computer. */
  daemonId?: string
  /** Whether the session takes input and how many prompts it has queued (turn push actions). */
  turnInfo?: (sessionId: string) => TurnInfo | null
}

/** Decides which events become a push and builds content-free payloads. */
export class PushService {
  constructor(
    private readonly sender: PushSender | null,
    private readonly devices: DeviceRegistry,
    private readonly logger: Logger,
    private readonly options: PushServiceOptions,
  ) {}

  private profileName(profileId: string | null): string {
    return this.options.profiles.find((p) => p.id === profileId)?.name ?? profileId ?? 'Claude'
  }

  messageForHook(hook: HookEvent): PushMessage | null {
    const sessionId = hook.payload.session_id
    const base = { sessionId, profileId: hook.profileId ?? '', event: hook.event }
    const category = turnCategory(this.options.turnInfo?.(sessionId) ?? null)
    const turn = category ? { category } : {}
    if (hook.event === 'Stop') {
      return {
        title: this.options.messages.sessionDone,
        body: this.profileName(hook.profileId),
        data: base,
        ...turn,
      }
    }
    if (hook.event === 'Notification') {
      const type = hook.payload.notification_type
      // permission prompts are announced by the PermissionRequest flow (with actions).
      if (type === 'permission_prompt' || type === 'auth_success') return null
      return {
        title: this.options.messages.sessionWaiting,
        body: this.profileName(hook.profileId),
        data: base,
        ...turn,
      }
    }
    return null
  }

  messageForPermission(info: PermissionRequestInfo): PushMessage {
    const { messages } = this.options
    const kind = info.interaction?.kind
    return {
      title:
        kind === 'question'
          ? messages.questionPending
          : kind === 'plan'
            ? messages.planPending
            : messages.permissionPending,
      body: this.profileName(info.profileId),
      data: {
        sessionId: info.sessionId,
        profileId: info.profileId,
        event: 'PermissionRequest',
        requestId: info.requestId,
      },
      // Questions and plans are answered in the app: no one-tap Allow/Deny.
      ...(kind ? {} : { category: PERMISSION_CATEGORY }),
    }
  }

  /** A question or plan still open after a while: a content-free reminder, opened as the session. */
  messageForReminder(info: PermissionRequestInfo): PushMessage | null {
    const kind = info.interaction?.kind
    if (!kind) return null
    const { messages } = this.options
    return {
      title: kind === 'question' ? messages.questionReminder : messages.planReminder,
      body: this.profileName(info.profileId),
      data: { sessionId: info.sessionId, profileId: info.profileId, event: 'PermissionReminder' },
    }
  }

  testMessage(): PushMessage {
    return {
      title: this.options.messages.testTitle,
      body: this.options.messages.testBody(this.options.host),
      data: { event: 'test' },
    }
  }

  /**
   * Test push asked by the user: to the given phone only (every phone without one), even with the
   * app in the foreground or muted.
   */
  private tagged(message: PushMessage): PushMessage {
    const { daemonId } = this.options
    return daemonId ? { ...message, data: { ...message.data, daemonId } } : message
  }

  async sendTest(token?: string): Promise<{ result: PushTestResult; sent: number }> {
    if (!this.sender || this.options.mode() === 'off') return { result: 'off', sent: 0 }
    const devices = this.devices.devices().filter((d) => token === undefined || d.token === token)
    if (devices.length === 0) return { result: 'unregistered', sent: 0 }
    try {
      const { invalidTokens } = await this.sender.send(devices, this.tagged(this.testMessage()))
      await this.devices.remove(invalidTokens)
      const sent = devices.length - invalidTokens.length
      return { result: sent > 0 ? 'sent' : 'failed', sent }
    } catch (error) {
      this.logger.warn({ err: error }, 'test push failed')
      return { result: 'failed', sent: 0 }
    }
  }

  async notify(message: PushMessage | null): Promise<boolean> {
    if (!message || !this.sender) return false
    const sessionId = message.data.sessionId ?? ''
    if (this.options.hasForegroundClient()) return false
    if (this.options.isMuted(message.data.profileId || null, sessionId)) return false
    const devices = this.devices.devices()
    if (devices.length === 0) return false
    // Android builds that draw turn pushes get them as data messages, with the actions.
    const drawn = (d: (typeof devices)[number]) =>
      message.category?.startsWith(TURN_CATEGORY) === true &&
      d.platform === 'android' &&
      d.turnActions === true
    const data = devices.filter(drawn)
    const plain = devices.filter((d) => !drawn(d))
    try {
      const tagged = this.tagged(message)
      const sent = await Promise.all([
        plain.length > 0 ? this.sender.send(plain, tagged) : { invalidTokens: [] },
        data.length > 0 ? this.sender.send(data, { ...tagged, androidData: true }) : { invalidTokens: [] },
      ])
      await this.devices.remove(sent.flatMap((s) => s.invalidTokens))
      return true
    } catch (error) {
      this.logger.warn({ err: error }, 'push failed')
      return false
    }
  }
}
