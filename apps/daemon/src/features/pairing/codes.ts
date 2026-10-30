import {
  bytesToBase64Url,
  type NoiseCrypto,
  PAIRING_CODE_TTL_MS,
  pairingIdOf,
} from '@remote-harness/protocol'

export type LiveCode = { secret: Uint8Array; pairingId: string; expiresAt: number }

/** The tray keeps showing its current code while at least this much of it is left. */
export const REUSE_MIN_LEFT_MS = 60_000

/**
 * Pairing codes live only in this process's memory: a code is accepted for one successful pairing
 * within its lifetime, and a restart forgets every code.
 */
export class PairingCodes {
  private readonly codes = new Map<string, LiveCode>()
  private lastShown: LiveCode | null = null

  constructor(
    private readonly crypto: NoiseCrypto,
    private readonly now: () => number = Date.now,
    private readonly ttlMs = PAIRING_CODE_TTL_MS,
  ) {}

  /** A new code (the CLI, the setup and `pairing.create` each get their own). */
  create(): LiveCode {
    this.sweep()
    const secret = this.crypto.randomBytes(32)
    const code = {
      secret,
      pairingId: bytesToBase64Url(pairingIdOf(this.crypto, secret)),
      expiresAt: this.now() + this.ttlMs,
    }
    this.codes.set(code.pairingId, code)
    return code
  }

  /** The code the tray shows: the last one while it is unused and has more than a minute left. */
  current(): LiveCode {
    const last = this.lastShown
    if (last && this.codes.has(last.pairingId) && last.expiresAt - this.now() > REUSE_MIN_LEFT_MS) return last
    this.lastShown = this.create()
    return this.lastShown
  }

  /** The secret of a live code, without using it up (the handshake may still fail). */
  secretFor(pairingId: Uint8Array): Uint8Array | null {
    const code = this.codes.get(bytesToBase64Url(pairingId))
    if (!code) return null
    if (code.expiresAt <= this.now()) {
      this.codes.delete(code.pairingId)
      return null
    }
    return code.secret
  }

  /** Uses a code up after a successful handshake; false when it was used (or expired) meanwhile. */
  consume(pairingId: Uint8Array): boolean {
    const id = bytesToBase64Url(pairingId)
    const code = this.codes.get(id)
    this.codes.delete(id)
    return code !== undefined && code.expiresAt > this.now()
  }

  private sweep(): void {
    const now = this.now()
    for (const [id, code] of this.codes) if (code.expiresAt <= now) this.codes.delete(id)
  }
}
