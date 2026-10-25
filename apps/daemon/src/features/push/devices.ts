import {
  type DevicePlatform,
  DevicePlatformSchema,
  type PushRelay,
  PushRelaySchema,
} from '@remote-harness/protocol'
import { z } from 'zod'
import { readJsonFile, writeJsonAtomic } from '../../infra/fs.ts'
import { MAX_PAIRED_DEVICES } from '../pairing/devices.ts'

const DeviceSchema = z.object({
  token: z.string(),
  // Missing in files written before Android support (those phones are iPhones).
  platform: DevicePlatformSchema.optional(),
  /** Push relay grant, used when the daemon has no Firebase service account. */
  relay: PushRelaySchema.optional(),
  /** The paired device that registered it (its short ID); one registration per device. */
  deviceId: z.string().optional(),
  registeredAt: z.string(),
})
const DevicesSchema = z.object({ tokens: z.array(DeviceSchema) })

export type Device = z.infer<typeof DeviceSchema>

const PLATFORM_LABEL: Record<DevicePlatform, string> = { ios: 'iOS', android: 'Android' }

/**
 * Platforms of the registered phones for `doctor`, newest first (e.g. `Android, iOS`), or null when
 * none is registered. Devices without a platform were registered by the iOS-only app.
 */
export function describeDevices(devices: readonly Device[]): string | null {
  if (devices.length === 0) return null
  return devices.map((d) => PLATFORM_LABEL[d.platform ?? 'ios']).join(', ')
}

/** One registration per paired device, so as many as the daemon pairs. */
export const MAX_DEVICES = MAX_PAIRED_DEVICES

/**
 * FCM tokens of paired devices, newest first: a device's new token replaces its old one, and the
 * registrations of devices that are no longer paired are dropped.
 */
export class DeviceRegistry {
  private tokens: Device[] = []

  constructor(private readonly path: string) {}

  async load(): Promise<void> {
    const parsed = DevicesSchema.safeParse(await readJsonFile(this.path).catch(() => undefined))
    this.tokens = parsed.success ? parsed.data.tokens : []
  }

  list(): string[] {
    return this.tokens.map((t) => t.token)
  }

  /** Registered devices with their platform, newest first (for `doctor`). */
  devices(): readonly Device[] {
    return this.tokens
  }

  async register(
    token: string,
    platform?: DevicePlatform,
    relay?: PushRelay,
    deviceId?: string,
  ): Promise<void> {
    this.tokens = [
      {
        token,
        ...(platform ? { platform } : {}),
        ...(relay ? { relay } : {}),
        ...(deviceId ? { deviceId } : {}),
        registeredAt: new Date().toISOString(),
      },
      ...this.tokens.filter((t) => t.token !== token && (deviceId === undefined || t.deviceId !== deviceId)),
    ].slice(0, MAX_DEVICES)
    await writeJsonAtomic(this.path, { tokens: this.tokens }, 0o600)
  }

  /** Drops the registration of a revoked device; returns its tokens. */
  async removeDevice(deviceId: string): Promise<string[]> {
    const tokens = this.tokens.filter((t) => t.deviceId === deviceId).map((t) => t.token)
    await this.keep((t) => t.deviceId !== deviceId)
    return tokens
  }

  /** Keeps only the registrations of paired devices (protocol-1 ones carry no device and go too). */
  async prune(pairedIds: ReadonlySet<string>): Promise<void> {
    await this.keep((t) => t.deviceId !== undefined && pairedIds.has(t.deviceId))
  }

  private async keep(predicate: (device: Device) => boolean): Promise<void> {
    const kept = this.tokens.filter(predicate)
    if (kept.length === this.tokens.length) return
    this.tokens = kept
    await writeJsonAtomic(this.path, { tokens: this.tokens }, 0o600)
  }

  async remove(tokens: readonly string[]): Promise<void> {
    if (tokens.length === 0) return
    this.tokens = this.tokens.filter((t) => !tokens.includes(t.token))
    await writeJsonAtomic(this.path, { tokens: this.tokens }, 0o600)
  }
}
