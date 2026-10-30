/**
 * The Noise Protocol Framework (revision 34) for the two patterns Remote Harness uses, with
 * 25519, ChaChaPoly and SHA256: `XXpsk3` to pair a device and `IK` to reconnect it.
 */
import { concatBytes, utf8Encode } from './bytes.ts'
import type { KeyPair, NoiseCrypto } from './crypto.ts'

export const DH_LENGTH = 32
const HASH_LENGTH = 32
const TAG_LENGTH = 16
const MAX_NONCE = 2n ** 64n - 1n
/** Noise messages are at most 65535 bytes. */
export const MAX_NOISE_MESSAGE = 65535

export class NoiseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoiseError'
  }
}

export class CipherState {
  private key: Uint8Array | null = null
  private nonce = 0n

  constructor(private readonly crypto: NoiseCrypto) {}

  initializeKey(key: Uint8Array | null): void {
    this.key = key
    this.nonce = 0n
  }

  hasKey(): boolean {
    return this.key !== null
  }

  encryptWithAd(ad: Uint8Array, plaintext: Uint8Array): Uint8Array {
    if (!this.key) return plaintext
    if (this.nonce >= MAX_NONCE) throw new NoiseError('nonce exhausted')
    const ciphertext = this.crypto.encrypt(this.key, this.nonce, ad, plaintext)
    this.nonce += 1n
    return ciphertext
  }

  /** On a failed tag the nonce does not advance and NoiseError is thrown. */
  decryptWithAd(ad: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    if (!this.key) return ciphertext
    if (this.nonce >= MAX_NONCE) throw new NoiseError('nonce exhausted')
    let plaintext: Uint8Array
    try {
      plaintext = this.crypto.decrypt(this.key, this.nonce, ad, ciphertext)
    } catch {
      throw new NoiseError('decryption failed')
    }
    this.nonce += 1n
    return plaintext
  }
}

class SymmetricState {
  readonly cipher: CipherState
  private chainingKey: Uint8Array
  hash: Uint8Array

  constructor(
    private readonly crypto: NoiseCrypto,
    protocolName: string,
  ) {
    this.cipher = new CipherState(crypto)
    const name = utf8Encode(protocolName)
    if (name.length <= HASH_LENGTH) {
      this.hash = new Uint8Array(HASH_LENGTH)
      this.hash.set(name)
    } else {
      this.hash = crypto.sha256(name)
    }
    this.chainingKey = this.hash
  }

  private hkdf(ikm: Uint8Array, outputs: 2 | 3): Uint8Array[] {
    const temp = this.crypto.hmacSha256(this.chainingKey, ikm)
    const out1 = this.crypto.hmacSha256(temp, Uint8Array.of(1))
    const out2 = this.crypto.hmacSha256(temp, concatBytes(out1, Uint8Array.of(2)))
    if (outputs === 2) return [out1, out2]
    return [out1, out2, this.crypto.hmacSha256(temp, concatBytes(out2, Uint8Array.of(3)))]
  }

  mixKey(ikm: Uint8Array): void {
    const [chainingKey, key] = this.hkdf(ikm, 2) as [Uint8Array, Uint8Array]
    this.chainingKey = chainingKey
    this.cipher.initializeKey(key)
  }

  mixHash(data: Uint8Array): void {
    this.hash = this.crypto.sha256(concatBytes(this.hash, data))
  }

  mixKeyAndHash(ikm: Uint8Array): void {
    const [chainingKey, hash, key] = this.hkdf(ikm, 3) as [Uint8Array, Uint8Array, Uint8Array]
    this.chainingKey = chainingKey
    this.mixHash(hash)
    this.cipher.initializeKey(key)
  }

  encryptAndHash(plaintext: Uint8Array): Uint8Array {
    const ciphertext = this.cipher.encryptWithAd(this.hash, plaintext)
    this.mixHash(ciphertext)
    return ciphertext
  }

  decryptAndHash(ciphertext: Uint8Array): Uint8Array {
    const plaintext = this.cipher.decryptWithAd(this.hash, ciphertext)
    this.mixHash(ciphertext)
    return plaintext
  }

  split(): [CipherState, CipherState] {
    const [k1, k2] = this.hkdf(new Uint8Array(0), 2) as [Uint8Array, Uint8Array]
    const c1 = new CipherState(this.crypto)
    const c2 = new CipherState(this.crypto)
    c1.initializeKey(k1)
    c2.initializeKey(k2)
    return [c1, c2]
  }
}

type Token = 'e' | 's' | 'ee' | 'es' | 'se' | 'ss' | 'psk'

export type PatternName = 'XXpsk3' | 'IK'

const PATTERNS: Record<PatternName, { preResponder: boolean; messages: Token[][]; psk: boolean }> = {
  XXpsk3: {
    preResponder: false,
    messages: [['e'], ['e', 'ee', 's', 'es'], ['s', 'se', 'psk']],
    psk: true,
  },
  IK: {
    preResponder: true,
    messages: [
      ['e', 'es', 's', 'ss'],
      ['e', 'ee', 'se'],
    ],
    psk: false,
  },
}

export function protocolName(pattern: PatternName): string {
  return `Noise_${pattern}_25519_ChaChaPoly_SHA256`
}

export type HandshakeOptions = {
  pattern: PatternName
  initiator: boolean
  prologue: Uint8Array
  /** This side's static key pair. */
  staticKey: KeyPair
  /** The responder's static public key, known before the handshake in IK. */
  remoteStatic?: Uint8Array
  /** The pre-shared key of `psk` patterns (32 bytes). */
  psk?: Uint8Array
  /** Fixed ephemeral key (test vectors only). */
  ephemeral?: KeyPair
}

export type HandshakeResult = {
  /** Cipher for the messages this side sends, and for the ones it receives. */
  send: CipherState
  receive: CipherState
  handshakeHash: Uint8Array
  remoteStatic: Uint8Array
}

/** One side of a handshake: call writeMessage / readMessage in the pattern's order. */
export class HandshakeState {
  private readonly symmetric: SymmetricState
  private readonly messages: Token[][]
  private readonly initiator: boolean
  private readonly staticKey: KeyPair
  private readonly psk: Uint8Array | undefined
  private readonly usesPsk: boolean
  private ephemeral: KeyPair | undefined
  private remoteEphemeral: Uint8Array | undefined
  private remoteStaticKey: Uint8Array | undefined
  private index = 0
  private result: HandshakeResult | null = null

  constructor(
    private readonly crypto: NoiseCrypto,
    options: HandshakeOptions,
  ) {
    const pattern = PATTERNS[options.pattern]
    if (pattern.psk && options.psk?.length !== 32) throw new NoiseError('psk must be 32 bytes')
    if (pattern.preResponder && options.initiator && !options.remoteStatic)
      throw new NoiseError('the responder static key is required')
    this.symmetric = new SymmetricState(crypto, protocolName(options.pattern))
    this.messages = pattern.messages
    this.initiator = options.initiator
    this.staticKey = options.staticKey
    this.psk = options.psk
    this.usesPsk = pattern.psk
    this.ephemeral = options.ephemeral
    this.remoteStaticKey = options.initiator ? options.remoteStatic : undefined
    this.symmetric.mixHash(options.prologue)
    if (pattern.preResponder) {
      this.symmetric.mixHash(
        options.initiator ? (options.remoteStatic as Uint8Array) : this.staticKey.publicKey,
      )
    }
  }

  /** True when it is this side's turn to write. */
  get myTurn(): boolean {
    return (this.index % 2 === 0) === this.initiator
  }

  get complete(): boolean {
    return this.result !== null
  }

  /** The remote static key once a message carrying it was read (or the known one in IK). */
  get remoteStatic(): Uint8Array | undefined {
    return this.remoteStaticKey
  }

  get handshakeResult(): HandshakeResult {
    if (!this.result) throw new NoiseError('handshake not complete')
    return this.result
  }

  writeMessage(payload: Uint8Array = new Uint8Array(0)): Uint8Array {
    const tokens = this.nextTokens(true)
    const parts: Uint8Array[] = []
    for (const token of tokens) {
      switch (token) {
        case 'e': {
          this.ephemeral ??= this.crypto.generateKeyPair()
          parts.push(this.ephemeral.publicKey)
          this.symmetric.mixHash(this.ephemeral.publicKey)
          if (this.usesPsk) this.symmetric.mixKey(this.ephemeral.publicKey)
          break
        }
        case 's':
          parts.push(this.symmetric.encryptAndHash(this.staticKey.publicKey))
          break
        case 'psk':
          this.symmetric.mixKeyAndHash(this.psk as Uint8Array)
          break
        default:
          this.mixDh(token)
      }
    }
    parts.push(this.symmetric.encryptAndHash(payload))
    const message = concatBytes(...parts)
    if (message.length > MAX_NOISE_MESSAGE) throw new NoiseError('handshake message too long')
    this.advance()
    return message
  }

  /** Returns the payload; throws NoiseError when the message is malformed or does not decrypt. */
  readMessage(message: Uint8Array): Uint8Array {
    if (message.length > MAX_NOISE_MESSAGE) throw new NoiseError('handshake message too long')
    const tokens = this.nextTokens(false)
    let offset = 0
    const take = (length: number) => {
      if (offset + length > message.length) throw new NoiseError('handshake message too short')
      const part = message.subarray(offset, offset + length)
      offset += length
      return part
    }
    for (const token of tokens) {
      switch (token) {
        case 'e': {
          const e = Uint8Array.from(take(DH_LENGTH))
          this.remoteEphemeral = e
          this.symmetric.mixHash(e)
          if (this.usesPsk) this.symmetric.mixKey(e)
          break
        }
        case 's': {
          const length = this.symmetric.cipher.hasKey() ? DH_LENGTH + TAG_LENGTH : DH_LENGTH
          this.remoteStaticKey = Uint8Array.from(this.symmetric.decryptAndHash(take(length)))
          break
        }
        case 'psk':
          this.symmetric.mixKeyAndHash(this.psk as Uint8Array)
          break
        default:
          this.mixDh(token)
      }
    }
    const payload = this.symmetric.decryptAndHash(message.subarray(offset))
    this.advance()
    return payload
  }

  private nextTokens(writing: boolean): Token[] {
    if (this.result) throw new NoiseError('handshake already complete')
    if (writing !== this.myTurn)
      throw new NoiseError(writing ? 'not our turn to write' : 'not our turn to read')
    return this.messages[this.index] as Token[]
  }

  private mixDh(token: 'ee' | 'es' | 'se' | 'ss'): void {
    // The first letter is the initiator's key, the second the responder's.
    const [initiatorKey, responderKey] = [token[0], token[1]] as ['e' | 's', 'e' | 's']
    const localKind = this.initiator ? initiatorKey : responderKey
    const remoteKind = this.initiator ? responderKey : initiatorKey
    const local = localKind === 'e' ? this.ephemeral : this.staticKey
    const remote = remoteKind === 'e' ? this.remoteEphemeral : this.remoteStaticKey
    if (!local || !remote) throw new NoiseError(`missing key for ${token}`)
    let shared: Uint8Array
    try {
      shared = this.crypto.dh(local.privateKey, remote)
    } catch {
      throw new NoiseError('invalid public key')
    }
    this.symmetric.mixKey(shared)
  }

  private advance(): void {
    this.index += 1
    if (this.index < this.messages.length) return
    const [c1, c2] = this.symmetric.split()
    this.result = {
      send: this.initiator ? c1 : c2,
      receive: this.initiator ? c2 : c1,
      handshakeHash: this.symmetric.hash,
      remoteStatic: this.remoteStaticKey as Uint8Array,
    }
  }
}
