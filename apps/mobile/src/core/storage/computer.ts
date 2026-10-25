import {
  base64UrlToBytes,
  bytesToBase64Url,
  type DaemonPaths,
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
  /** Every relay the daemon may use (tried when the home relay does not have it). */
  relays: string[]
  /** Machine name from the pairing code (the daemon's host name until it says otherwise). */
  name: string
  /** The name the user gave it in this app. */
  alias?: string
}

const key = z.string().refine((value) => base64UrlToBytes(value)?.length === 32)
const relayUrl = z.string().regex(/^wss?:\/\/\S+$/)

const StoredComputerSchema = z.object({
  v: z.literal(2),
  daemonId: z.string().regex(/^[0-9a-f]{32}$/),
  daemonKey: key,
  deviceKey: z.object({ publicKey: key, privateKey: key }),
  addresses: z.array(z.string().refine(isAddress)),
  relay: relayUrl.optional(),
  relays: z.array(relayUrl).default([]),
  name: z.string(),
  alias: z.string().optional(),
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
    relays: computer.relays,
    name: computer.name,
    ...(computer.alias ? { alias: computer.alias } : {}),
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
      relays: d.relays,
      name: d.name,
      ...(d.alias ? { alias: d.alias } : {}),
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
    relays: code.relay ? [code.relay] : [],
    name: code.name,
  }
}

/** The computer with the paths its daemon announced; the same object when nothing changed. */
export function withPaths(computer: Computer, paths: DaemonPaths): Computer {
  const relay = paths.relay ?? computer.relay
  const relays = paths.relays.length > 0 ? paths.relays : computer.relays
  const same =
    JSON.stringify([computer.addresses, computer.relay ?? null, computer.relays]) ===
    JSON.stringify([paths.addresses, relay ?? null, relays])
  if (same) return computer
  return { ...computer, addresses: paths.addresses, ...(relay ? { relay } : {}), relays }
}

/** Which computers are paired (by daemon ID, most recently used first) and which one is active. */
export type ComputersIndex = { active: string | null; ids: string[] }

export const EMPTY_INDEX: ComputersIndex = { active: null, ids: [] }

const IndexSchema = z.object({
  active: z.string().nullable(),
  ids: z.array(z.string().regex(/^[0-9a-f]{32}$/)),
})

export function parseIndex(raw: string | null): ComputersIndex {
  if (!raw) return EMPTY_INDEX
  try {
    const parsed = IndexSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return EMPTY_INDEX
    const { ids } = parsed.data
    return {
      ids,
      active: parsed.data.active && ids.includes(parsed.data.active) ? parsed.data.active : (ids[0] ?? null),
    }
  } catch {
    return EMPTY_INDEX
  }
}

/** Adds (or moves to the front) a computer and makes it active. */
export function addToIndex(index: ComputersIndex, id: string): ComputersIndex {
  return { active: id, ids: [id, ...index.ids.filter((other) => other !== id)] }
}

/** Removes a computer; when it was active, the next one (most recently used) becomes active. */
export function removeFromIndex(index: ComputersIndex, id: string): ComputersIndex {
  const ids = index.ids.filter((other) => other !== id)
  return { ids, active: index.active === id ? (ids[0] ?? null) : index.active }
}

export function activateInIndex(index: ComputersIndex, id: string): ComputersIndex {
  return index.ids.includes(id) ? addToIndex(index, id) : index
}
