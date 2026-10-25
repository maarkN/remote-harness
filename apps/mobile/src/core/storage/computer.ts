import {
  base64UrlToBytes,
  bytesToBase64Url,
  isAddress,
  type KeyPair,
  type PairingCode,
} from '@remote-harness/protocol'
import { z } from 'zod'

/** A paired computer as this device keeps it (SecureStore, this device only). */
export type Computer = {
  daemonId: string
  /** The daemon's Noise static public key, pinned at pairing. */
  daemonKey: Uint8Array
  /** This device's key pair for that daemon. */
  deviceKey: KeyPair
  /** Direct `host:port` addresses. */
  addresses: string[]
  /** Home connection relay (`wss://…`), once the daemon has one. */
  relay?: string
  name: string
}

const key = z.string().refine((value) => base64UrlToBytes(value)?.length === 32)

const StoredComputerSchema = z.object({
  v: z.literal(2),
  daemonId: z.string().regex(/^[0-9a-f]{32}$/),
  daemonKey: key,
  deviceKey: z.object({ publicKey: key, privateKey: key }),
  addresses: z.array(z.string().refine(isAddress)),
  relay: z.string().optional(),
  name: z.string(),
})

const bytes = (value: string) => base64UrlToBytes(value) as Uint8Array

/** What is written to SecureStore. */
export function serializeComputer(computer: Computer): string {
  return JSON.stringify({
    v: 2,
    daemonId: computer.daemonId,
    daemonKey: bytesToBase64Url(computer.daemonKey),
    deviceKey: {
      publicKey: bytesToBase64Url(computer.deviceKey.publicKey),
      privateKey: bytesToBase64Url(computer.deviceKey.privateKey),
    },
    addresses: computer.addresses,
    ...(computer.relay ? { relay: computer.relay } : {}),
    name: computer.name,
  })
}

export type StoredComputer = { kind: 'computer'; computer: Computer } | { kind: 'legacy' } | { kind: 'none' }

/**
 * Reads the stored value: a computer, a credential from before protocol 2 (`host`/`port`/`token`,
 * to be discarded with the pair-again notice) or nothing usable.
 */
export function parseStoredComputer(raw: string | null): StoredComputer {
  if (!raw) return { kind: 'none' }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { kind: 'none' }
  }
  if (value && typeof value === 'object' && 'token' in value) return { kind: 'legacy' }
  const parsed = StoredComputerSchema.safeParse(value)
  if (!parsed.success) return { kind: 'none' }
  const d = parsed.data
  return {
    kind: 'computer',
    computer: {
      daemonId: d.daemonId,
      daemonKey: bytes(d.daemonKey),
      deviceKey: { publicKey: bytes(d.deviceKey.publicKey), privateKey: bytes(d.deviceKey.privateKey) },
      addresses: d.addresses,
      ...(d.relay ? { relay: d.relay } : {}),
      name: d.name,
    },
  }
}

/** The computer a successful pairing saves: the code's daemon and this device's new key. */
export function computerFromCode(code: PairingCode, deviceKey: KeyPair): Computer {
  return {
    daemonId: code.daemonId,
    daemonKey: code.daemonKey,
    deviceKey,
    addresses: code.addresses,
    ...(code.relay ? { relay: code.relay } : {}),
    name: code.name,
  }
}
