import {
  bytesToBase64Url,
  generateConfirmationCode,
  type NoiseCrypto,
  PAIRING_CODE_TTL_MS,
  pairingIdOf,
} from '@remote-harness/protocol'

export type LiveCode = {
  secret: Uint8Array
  pairingId: string
  expiresAt: number
  /** Shown once a device presents the code (ADR-0009); null until then. */
  confirmation: string | null
  /** Pairings with a wrong confirmation code so far. */
  attempts: number
}

/** The third wrong confirmation code burns the pairing code. */
export const MAX_CONFIRMATION_ATTEMPTS = 3

/** What `remote-harness pair` reads while it waits: the code's state and, once shown, its digits. */
export type CodeState =
  | { state: 'waiting' }
  | { state: 'presented'; code: string }
  | { state: 'paired' }
  | { state: 'locked' }
  | { state: 'expired' }

/** The tray keeps showing its current code while at least this much of it is left. */
export const REUSE_MIN_LEFT_MS = 60_000

/**
 * Pairing codes live only in this process's memory: a code is accepted for one successful pairing
 * within its lifetime, and a restart forgets every code.
 */
export class PairingCodes {
  private readonly codes = new Map<string, LiveCode>()
  /** How used codes ended, kept as long as a code lives so the CLI can read it. */
  private readonly outcomes = new Map<string, { state: 'paired' | 'locked'; until: number }>()
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
    const code: LiveCode = {
      secret,
      pairingId: bytesToBase64Url(pairingIdOf(this.crypto, secret)),
      expiresAt: this.now() + this.ttlMs,
      confirmation: null,
      attempts: 0,
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
    return this.live(bytesToBase64Url(pairingId))?.secret ?? null
  }

  /** The confirmation code a live code shows, or null while no device presented it. */
  confirmationFor(pairingId: Uint8Array): string | null {
    return this.live(bytesToBase64Url(pairingId))?.confirmation ?? null
  }

  /**
   * A device presented the code: its confirmation code, created on the first presentation and
   * kept for the code's lifetime (`created` says whether this call made it). Null for an unknown,
   * used or expired code.
   */
  present(pairingId: Uint8Array): { code: string; created: boolean } | null {
    const code = this.live(bytesToBase64Url(pairingId))
    if (!code) return null
    if (code.confirmation) return { code: code.confirmation, created: false }
    code.confirmation = generateConfirmationCode(this.crypto)
    return { code: code.confirmation, created: true }
  }

  /** Counts a pairing with a wrong confirmation code; the last allowed one burns the code. */
  wrongConfirmation(pairingId: Uint8Array): 'retry' | 'locked' {
    const id = bytesToBase64Url(pairingId)
    const code = this.live(id)
    if (!code) return 'locked'
    code.attempts += 1
    if (code.attempts < MAX_CONFIRMATION_ATTEMPTS) return 'retry'
    this.codes.delete(id)
    this.outcomes.set(id, { state: 'locked', until: code.expiresAt })
    return 'locked'
  }

  /** Uses a code up after a successful handshake; false when it was used (or expired) meanwhile. */
  consume(pairingId: Uint8Array): boolean {
    const id = bytesToBase64Url(pairingId)
    const code = this.codes.get(id)
    this.codes.delete(id)
    const ok = code !== undefined && code.expiresAt > this.now()
    if (ok) this.outcomes.set(id, { state: 'paired', until: code.expiresAt })
    return ok
  }

  /** Where a code stands, by its pairing ID (base64url), for the CLI waiting on it. */
  state(pairingId: string): CodeState {
    this.sweep()
    const outcome = this.outcomes.get(pairingId)
    if (outcome) return { state: outcome.state }
    const code = this.codes.get(pairingId)
    if (!code) return { state: 'expired' }
    return code.confirmation ? { state: 'presented', code: code.confirmation } : { state: 'waiting' }
  }

  private live(id: string): LiveCode | null {
    const code = this.codes.get(id)
    if (!code) return null
    if (code.expiresAt <= this.now()) {
      this.codes.delete(code.pairingId)
      return null
    }
    return code
  }

  private sweep(): void {
    const now = this.now()
    for (const [id, code] of this.codes) if (code.expiresAt <= now) this.codes.delete(id)
    for (const [id, outcome] of this.outcomes) if (outcome.until <= now) this.outcomes.delete(id)
  }
}
