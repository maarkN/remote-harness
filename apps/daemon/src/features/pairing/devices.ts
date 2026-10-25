import { readFile } from 'node:fs/promises'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  type DeviceInfo,
  type PairedDeviceInfo,
} from '@remote-harness/protocol'
import { z } from 'zod'
import { deviceIdOf } from '../../core/identity.ts'
import { writeFileAtomic } from '../../infra/fs.ts'

export { deviceIdOf }

/** A daemon accepts at most this many paired devices. */
export const MAX_PAIRED_DEVICES = 10

const PairedDeviceSchema = z.object({
  id: z.string(),
  publicKey: z.string(),
  name: z.string(),
  platform: z.string(),
  pairedAt: z.number(),
  /** Last time the device authenticated; absent until it reconnects once. */
  lastSeen: z.number().optional(),
})
export type PairedDevice = z.infer<typeof PairedDeviceSchema>
const FileSchema = z.object({ devices: z.array(PairedDeviceSchema) })

/** The wire form of a device for `devices.result` (ISO times). */
export function deviceInfoOf(device: PairedDevice, currentId?: string): PairedDeviceInfo {
  return {
    id: device.id,
    name: device.name,
    platform: device.platform,
    pairedAt: new Date(device.pairedAt).toISOString(),
    lastSeen: device.lastSeen === undefined ? null : new Date(device.lastSeen).toISOString(),
    current: device.id === currentId,
  }
}

/** The devices paired with this daemon, kept in `paired-devices.json` (public keys only). */
export class PairedDevices {
  private list: PairedDevice[] = []
  private keys = new Set<string>()

  constructor(
    private readonly path: string,
    private readonly now: () => number = Date.now,
  ) {}

  async load(): Promise<void> {
    try {
      const parsed = FileSchema.safeParse(JSON.parse(await readFile(this.path, 'utf8')))
      this.set(
        parsed.success ? parsed.data.devices.filter((d) => base64UrlToBytes(d.publicKey)?.length === 32) : [],
      )
    } catch {
      this.set([])
    }
  }

  devices(): PairedDevice[] {
    return [...this.list]
  }

  has(publicKey: Uint8Array): boolean {
    return this.keys.has(bytesToBase64Url(publicKey))
  }

  ids(): Set<string> {
    return new Set(this.list.map((d) => d.id))
  }

  /** Adds (or renames) a device; false when it is new and the daemon already has the maximum. */
  async add(publicKey: Uint8Array, info: DeviceInfo): Promise<boolean> {
    const key = bytesToBase64Url(publicKey)
    const existing = this.list.find((d) => d.publicKey === key)
    if (!existing && this.list.length >= MAX_PAIRED_DEVICES) return false
    const now = this.now()
    const device: PairedDevice = {
      id: deviceIdOf(publicKey),
      publicKey: key,
      name: info.name || existing?.name || '',
      platform: info.platform || existing?.platform || '',
      pairedAt: existing?.pairedAt ?? now,
      lastSeen: now,
    }
    this.set([...this.list.filter((d) => d.publicKey !== key), device])
    await this.save()
    return true
  }

  /** Records that a device authenticated now. */
  async touch(publicKey: Uint8Array): Promise<void> {
    const key = bytesToBase64Url(publicKey)
    const device = this.list.find((d) => d.publicKey === key)
    if (!device) return
    device.lastSeen = this.now()
    await this.save()
  }

  /** Removes a device; its key is refused from then on. Null when no device has that ID. */
  async revoke(id: string): Promise<PairedDevice | null> {
    const device = this.list.find((d) => d.id === id)
    if (!device) return null
    this.set(this.list.filter((d) => d.id !== id))
    await this.save()
    return device
  }

  private set(devices: PairedDevice[]): void {
    this.list = devices
    this.keys = new Set(devices.map((d) => d.publicKey))
  }

  private async save(): Promise<void> {
    await writeFileAtomic(this.path, `${JSON.stringify({ devices: this.list }, null, 2)}\n`, 0o600)
  }
}
