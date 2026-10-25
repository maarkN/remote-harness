import * as nodeCrypto from 'node:crypto'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToHex,
  concatBytes,
  createNoiseCrypto,
  type KeyPair,
  type NodeLikeCrypto,
  type NoiseCrypto,
} from '@remote-harness/protocol'
import type { TokenStore } from './secrets.ts'

/** Noise primitives backed by Node's `crypto` (OpenSSL). */
export const noiseCrypto: NoiseCrypto = createNoiseCrypto(nodeCrypto as unknown as NodeLikeCrypto)

/**
 * Who this daemon is: the Noise static key devices pin at pairing, and the Ed25519 key that proves
 * to the connection relay that it owns the room named by its daemon ID (ADR-0002, ADR-0003).
 */
export type DaemonIdentity = {
  noise: KeyPair
  relay: { publicKey: Uint8Array; seed: Uint8Array }
  daemonId: string
}

const KEY = 32
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

/** First 16 bytes of SHA-256 of the relay public key, in hex (the connection relay computes the same). */
export function daemonIdOf(relayPublicKey: Uint8Array): string {
  return bytesToHex(noiseCrypto.sha256(relayPublicKey).subarray(0, 16))
}

function relayKeyFromSeed(seed: Uint8Array): nodeCrypto.KeyObject {
  return nodeCrypto.createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  })
}

function relayPublicKey(seed: Uint8Array): Uint8Array {
  const der = nodeCrypto.createPublicKey(relayKeyFromSeed(seed)).export({ format: 'der', type: 'spki' })
  return Uint8Array.from(der.subarray(der.length - KEY))
}

export function generateIdentity(): DaemonIdentity {
  const seed = Uint8Array.from(nodeCrypto.randomBytes(KEY))
  const relay = { seed, publicKey: relayPublicKey(seed) }
  return { noise: noiseCrypto.generateKeyPair(), relay, daemonId: daemonIdOf(relay.publicKey) }
}

/** The secret-store value: base64url of the Noise private and public keys and the relay seed and public key. */
export function encodeIdentity(identity: DaemonIdentity): string {
  return bytesToBase64Url(
    concatBytes(
      identity.noise.privateKey,
      identity.noise.publicKey,
      identity.relay.seed,
      identity.relay.publicKey,
    ),
  )
}

/** Null when the stored value is not a valid identity (its public keys must match its private ones). */
export function decodeIdentity(text: string): DaemonIdentity | null {
  const bytes = base64UrlToBytes(text.trim())
  if (bytes?.length !== 4 * KEY) return null
  const part = (i: number) => Uint8Array.from(bytes.subarray(i * KEY, (i + 1) * KEY))
  const noise = { privateKey: part(0), publicKey: part(1) }
  const relay = { seed: part(2), publicKey: part(3) }
  try {
    if (bytesToHex(noiseCrypto.publicKey(noise.privateKey)) !== bytesToHex(noise.publicKey)) return null
    if (bytesToHex(relayPublicKey(relay.seed)) !== bytesToHex(relay.publicKey)) return null
  } catch {
    return null
  }
  return { noise, relay, daemonId: daemonIdOf(relay.publicKey) }
}

/** Loads the identity from the secret store, creating it on the first start. */
export async function ensureIdentity(store: TokenStore): Promise<DaemonIdentity> {
  const stored = await store.get()
  if (stored) {
    const identity = decodeIdentity(stored)
    if (identity) return identity
    throw new Error(
      'the stored daemon identity is corrupt; remove it from the secret store to create a new one',
    )
  }
  const identity = generateIdentity()
  await store.set(encodeIdentity(identity))
  return identity
}

/** Signs a connection relay challenge with the relay key (the relay verifies with the public key). */
export function signRelayChallenge(identity: DaemonIdentity, message: Uint8Array): Uint8Array {
  return Uint8Array.from(nodeCrypto.sign(null, message, relayKeyFromSeed(identity.relay.seed)))
}
