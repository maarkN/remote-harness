import { concatBytes, hexToBytes } from './bytes.ts'

export type KeyPair = { publicKey: Uint8Array; privateKey: Uint8Array }

/** The primitives of `Noise_*_25519_ChaChaPoly_SHA256`, injected so the protocol code stays pure. */
export interface NoiseCrypto {
  /** X25519 public key of a 32-byte private key. */
  publicKey(privateKey: Uint8Array): Uint8Array
  generateKeyPair(): KeyPair
  dh(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array
  /** ChaCha20-Poly1305 with the Noise nonce (32 zero bits, then the counter little-endian). */
  encrypt(key: Uint8Array, nonce: bigint, ad: Uint8Array, plaintext: Uint8Array): Uint8Array
  /** Throws when the tag does not verify. */
  decrypt(key: Uint8Array, nonce: bigint, ad: Uint8Array, ciphertext: Uint8Array): Uint8Array
  sha256(data: Uint8Array): Uint8Array
  hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array
  randomBytes(length: number): Uint8Array
}

type Bytes = Uint8Array
interface AeadCipher {
  setAAD(ad: Bytes, options?: { plaintextLength: number }): unknown
  update(data: Bytes): Bytes
  final(): Bytes
}
interface Cipher extends AeadCipher {
  getAuthTag(): Bytes
}
interface Decipher extends AeadCipher {
  setAuthTag(tag: Bytes): unknown
}
interface Digest {
  update(data: Bytes): Digest
  digest(): Bytes
}
interface KeyObjectLike {
  export(options: { format: 'der'; type: 'spki' | 'pkcs8' }): Bytes | string | ArrayBuffer
}

/**
 * The subset of Node's `crypto` this module uses; `react-native-quick-crypto` implements the same
 * API, so the app and the daemon build `NoiseCrypto` the same way.
 */
export interface NodeLikeCrypto {
  createCipheriv(
    algorithm: 'chacha20-poly1305',
    key: Bytes,
    iv: Bytes,
    options: { authTagLength: 16 },
  ): Cipher
  createDecipheriv(
    algorithm: 'chacha20-poly1305',
    key: Bytes,
    iv: Bytes,
    options: { authTagLength: 16 },
  ): Decipher
  createHash(algorithm: 'sha256'): Digest
  createHmac(algorithm: 'sha256', key: Bytes): Digest
  createPrivateKey(options: { key: Bytes; format: 'der'; type: 'pkcs8' }): KeyObjectLike
  createPublicKey(options: { key: Bytes; format: 'der'; type: 'spki' } | KeyObjectLike): KeyObjectLike
  diffieHellman(options: { privateKey: KeyObjectLike; publicKey: KeyObjectLike }): Bytes
  randomBytes(size: number): Bytes
}

// DER wrappers of raw X25519 keys (RFC 8410): the key is the last 32 bytes.
const PKCS8_X25519 = hexToBytes('302e020100300506032b656e04220420')
const SPKI_X25519 = hexToBytes('302a300506032b656e032100')
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function asBytes(value: Bytes | string | ArrayBuffer): Uint8Array {
  if (typeof value === 'string') throw new Error('expected binary key export')
  return value instanceof Uint8Array ? value : new Uint8Array(value)
}

function checkKey(key: Uint8Array, what: string): void {
  if (key.length !== KEY_LENGTH) throw new Error(`${what} must be ${KEY_LENGTH} bytes`)
}

/** The 12-byte ChaChaPoly nonce Noise uses: 4 zero bytes, then the 64-bit counter little-endian. */
export function noiseNonce(n: bigint): Uint8Array {
  const nonce = new Uint8Array(12)
  let value = n
  for (let i = 4; i < 12; i++) {
    nonce[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return nonce
}

export function createNoiseCrypto(crypto: NodeLikeCrypto): NoiseCrypto {
  const privateKeyObject = (raw: Uint8Array) => {
    checkKey(raw, 'X25519 private key')
    return crypto.createPrivateKey({ key: concatBytes(PKCS8_X25519, raw), format: 'der', type: 'pkcs8' })
  }
  const publicKeyObject = (raw: Uint8Array) => {
    checkKey(raw, 'X25519 public key')
    return crypto.createPublicKey({ key: concatBytes(SPKI_X25519, raw), format: 'der', type: 'spki' })
  }
  const publicKey = (privateKey: Uint8Array) => {
    const der = asBytes(
      crypto.createPublicKey(privateKeyObject(privateKey)).export({ format: 'der', type: 'spki' }),
    )
    return Uint8Array.from(der.subarray(der.length - KEY_LENGTH))
  }
  return {
    publicKey,
    generateKeyPair() {
      const privateKey = Uint8Array.from(crypto.randomBytes(KEY_LENGTH))
      return { privateKey, publicKey: publicKey(privateKey) }
    },
    dh(privateKey, remote) {
      return Uint8Array.from(
        crypto.diffieHellman({
          privateKey: privateKeyObject(privateKey),
          publicKey: publicKeyObject(remote),
        }),
      )
    },
    encrypt(key, n, ad, plaintext) {
      const cipher = crypto.createCipheriv('chacha20-poly1305', key, noiseNonce(n), {
        authTagLength: TAG_LENGTH,
      })
      cipher.setAAD(ad, { plaintextLength: plaintext.length })
      return concatBytes(cipher.update(plaintext), cipher.final(), cipher.getAuthTag())
    },
    decrypt(key, n, ad, ciphertext) {
      if (ciphertext.length < TAG_LENGTH) throw new Error('ciphertext too short')
      const body = ciphertext.subarray(0, ciphertext.length - TAG_LENGTH)
      const decipher = crypto.createDecipheriv('chacha20-poly1305', key, noiseNonce(n), {
        authTagLength: TAG_LENGTH,
      })
      decipher.setAuthTag(ciphertext.subarray(ciphertext.length - TAG_LENGTH))
      decipher.setAAD(ad, { plaintextLength: body.length })
      return concatBytes(decipher.update(body), decipher.final())
    },
    sha256: (data) => Uint8Array.from(crypto.createHash('sha256').update(data).digest()),
    hmacSha256: (key, data) => Uint8Array.from(crypto.createHmac('sha256', key).update(data).digest()),
    randomBytes: (length) => Uint8Array.from(crypto.randomBytes(length)),
  }
}
