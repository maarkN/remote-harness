import { readFile } from 'node:fs/promises'
import { base64UrlToBytes, bytesToBase64Url, bytesToHex, type DeviceInfo } from '@remote-harness/protocol'
import { z } from 'zod'
import { noiseCrypto } from '../../core/identity.ts'
import { writeFileAtomic } from '../../infra/fs.ts'

/** A daemon accepts at most this many paired devices. */
export const MAX_PAIRED_DEVICES = 10

const PairedDeviceSchema = z.object({
  id: z.string(),
  publicKey: z.string(),
  name: z.string(),
  platform: z.string(),
  pairedAt: z.number(),
})
export type PairedDevice = z.infer<typeof PairedDeviceSchema>
const FileSchema = z.object({ devices: z.array(PairedDeviceSchema) })

/** Short, stable ID of a device: the first 8 bytes of SHA-256 of its static key, in hex. */
export function deviceIdOf(publicKey: Uint8Array): string {
  return bytesToHex(noiseCrypto.sha256(publicKey).subarray(0, 8))
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

  /** Adds (or renames) a device; false when it is new and the daemon already has the maximum. */
  async add(publicKey: Uint8Array, info: DeviceInfo): Promise<boolean> {
    const key = bytesToBase64Url(publicKey)
    const existing = this.list.find((d) => d.publicKey === key)
    if (!existing && this.list.length >= MAX_PAIRED_DEVICES) return false
    const device: PairedDevice = {
      id: deviceIdOf(publicKey),
      publicKey: key,
      name: info.name || existing?.name || '',
      platform: info.platform || existing?.platform || '',
      pairedAt: existing?.pairedAt ?? this.now(),
    }
    this.set([...this.list.filter((d) => d.publicKey !== key), device])
    await this.save()
    return true
  }

  private set(devices: PairedDevice[]): void {
    this.list = devices
    this.keys = new Set(devices.map((d) => d.publicKey))
  }

  private async save(): Promise<void> {
    await writeFileAtomic(this.path, `${JSON.stringify({ devices: this.list }, null, 2)}\n`, 0o600)
  }
}
