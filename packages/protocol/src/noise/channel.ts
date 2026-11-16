/**
 * The encrypted channel between a device and a daemon: connection preface, the two handshakes and
 * chunked transport messages. Every WebSocket message (direct or through the connection relay) is
 * one of these byte strings.
 */
import { concatBytes, equalBytes, utf8Decode, utf8Encode } from './bytes.ts'
import type { KeyPair, NoiseCrypto } from './crypto.ts'
import {
  type CipherState,
  type HandshakeResult,
  HandshakeState,
  MAX_NOISE_MESSAGE,
  NoiseError,
} from './handshake.ts'

/** Preface version: the first byte after `RH` in every connection. */
export const PREFACE_VERSION = 2
const MAGIC = [0x52, 0x48] as const
/** Pairing without a confirmation code: what apps before ADR-0009 send; the daemon refuses it. */
const MODE_PAIR_LEGACY = 0x01
const MODE_RECONNECT = 0x02
/** "A device is pairing with this code": the daemon shows the confirmation code and closes (4011). */
const MODE_ANNOUNCE = 0x03
/** Pairing with the confirmation code mixed into the PSK. */
const MODE_PAIR = 0x04
export const PAIRING_ID_LENGTH = 16
/** Digits of a confirmation code (ADR-0009). */
export const CONFIRMATION_CODE_LENGTH = 6
const CONFIRMATION_CONTEXT = utf8Encode('remote-harness pairing confirmation\0')
/** The largest multiple of 10^6 below 2^32: draws at or above it are thrown away. */
const CONFIRMATION_DRAW_LIMIT = 4_294_000_000
export const PAIRING_SECRET_LENGTH = 32
const PROLOGUE_CONTEXT = utf8Encode('remote-harness noise v1\0')
const PAIRING_ID_CONTEXT = utf8Encode('remote-harness pairing id\0')
/** Largest protocol message carried by the channel (an image attachment plus its envelope). */
export const MAX_CHANNEL_MESSAGE = 8 * 1024 * 1024
const TAG_LENGTH = 16
/** Plaintext of one transport message: a flag byte and the chunk. */
const MAX_CHUNK = MAX_NOISE_MESSAGE - TAG_LENGTH - 1
const FLAG_LAST = 0x00
const FLAG_MORE = 0x01

/** WebSocket close codes of the channel (the daemon closes; the app treats 4001/4002/4005–4007 as final). */
export const CHANNEL_CLOSE = {
  unauthorized: 4001,
  protocolMismatch: 4002,
  pairingRefused: 4005,
  deviceLimit: 4006,
  revoked: 4007,
  handshakeTimeout: 4008,
  /** The announce worked: the computer now shows the confirmation code. */
  confirmationShown: 4011,
  /** The pairing used another confirmation code than the one the computer shows. */
  wrongConfirmation: 4012,
  /** Too many wrong confirmation codes: the pairing code is burned. */
  confirmationLocked: 4013,
  tooBig: 1009,
} as const

/**
 * The connection relay only passes daemon close codes 4100–4199 to devices, so on the relay path
 * the daemon sends its 4000–4099 codes plus this offset.
 */
export const RELAY_CLOSE_OFFSET = 100

/** The code the daemon sends to the relay for a channel close (`relayCloseCode(4001)` is 4101). */
export function relayCloseCode(code: number): number {
  return code >= 4000 && code < 4100 ? code + RELAY_CLOSE_OFFSET : 4100
}

/** The channel close code a device received, on either path (4101 through the relay reads as 4001). */
export function normalizeChannelClose(code: number): number {
  return code > 4100 && code < 4200 ? code - RELAY_CLOSE_OFFSET : code
}

/**
 * `legacy-pair`: an app without confirmation codes (refused); `announce`: show the confirmation
 * code; `pair`: pair with it; `reconnect`: a paired device.
 */
export type Preface =
  | { mode: 'pair' | 'announce' | 'legacy-pair'; pairingId: Uint8Array }
  | { mode: 'reconnect' }

const MODE_BYTES = {
  'legacy-pair': MODE_PAIR_LEGACY,
  reconnect: MODE_RECONNECT,
  announce: MODE_ANNOUNCE,
  pair: MODE_PAIR,
} as const

export function encodePreface(preface: Preface): Uint8Array {
  const head = Uint8Array.of(...MAGIC, PREFACE_VERSION, MODE_BYTES[preface.mode])
  return preface.mode === 'reconnect' ? head : concatBytes(head, preface.pairingId)
}

export type DecodedPreface =
  | { ok: true; preface: Preface; prefaceBytes: Uint8Array; rest: Uint8Array }
  | { ok: false; reason: 'not_remote_harness' | 'version' | 'malformed' }

/** Splits the first message of a connection into the preface and the first handshake message. */
export function decodePreface(message: Uint8Array): DecodedPreface {
  if (message.length < 4 || message[0] !== MAGIC[0] || message[1] !== MAGIC[1])
    return { ok: false, reason: 'not_remote_harness' }
  if (message[2] !== PREFACE_VERSION) return { ok: false, reason: 'version' }
  if (message[3] === MODE_RECONNECT)
    return {
      ok: true,
      preface: { mode: 'reconnect' },
      prefaceBytes: message.subarray(0, 4),
      rest: message.subarray(4),
    }
  const mode =
    message[3] === MODE_PAIR
      ? 'pair'
      : message[3] === MODE_ANNOUNCE
        ? 'announce'
        : message[3] === MODE_PAIR_LEGACY
          ? 'legacy-pair'
          : null
  const end = 4 + PAIRING_ID_LENGTH
  // An announce is the preface alone; the pairing modes carry the first handshake message after it.
  if (mode && message.length >= end && (mode !== 'announce' || message.length === end)) {
    return {
      ok: true,
      preface: { mode, pairingId: Uint8Array.from(message.subarray(4, end)) },
      prefaceBytes: message.subarray(0, end),
      rest: message.subarray(end),
    }
  }
  return { ok: false, reason: 'malformed' }
}

/** The first and only message of an announce: "a device is pairing with this code". */
export function announcePreface(crypto: NoiseCrypto, secret: Uint8Array): Uint8Array {
  return encodePreface({ mode: 'announce', pairingId: pairingIdOf(crypto, secret) })
}

/** The XXpsk3 PSK of a pairing: the code's secret and the confirmation code shown on the computer. */
export function confirmationPsk(crypto: NoiseCrypto, secret: Uint8Array, confirmation: string): Uint8Array {
  if (!new RegExp(`^\\d{${CONFIRMATION_CODE_LENGTH}}$`).test(confirmation))
    throw new NoiseError('bad confirmation code')
  return crypto.hmacSha256(secret, concatBytes(CONFIRMATION_CONTEXT, utf8Encode(confirmation)))
}

/** Six random digits, drawn without modulo bias. */
export function generateConfirmationCode(crypto: Pick<NoiseCrypto, 'randomBytes'>): string {
  for (;;) {
    const bytes = crypto.randomBytes(4)
    const value = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0)
    if (value < CONFIRMATION_DRAW_LIMIT)
      return String(value % 10 ** CONFIRMATION_CODE_LENGTH).padStart(CONFIRMATION_CODE_LENGTH, '0')
  }
}

/** Binds the preface to the handshake: altering it makes the handshake fail. */
export function channelPrologue(prefaceBytes: Uint8Array): Uint8Array {
  return concatBytes(PROLOGUE_CONTEXT, prefaceBytes)
}

/** Identifies a pairing code to the daemon without revealing its secret. */
export function pairingIdOf(crypto: NoiseCrypto, secret: Uint8Array): Uint8Array {
  return crypto.sha256(concatBytes(PAIRING_ID_CONTEXT, secret)).subarray(0, PAIRING_ID_LENGTH)
}

/** What a device says about itself when it pairs (the third XXpsk3 message). */
export type DeviceInfo = { name: string; platform: string }

function encodeDeviceInfo(info: DeviceInfo): Uint8Array {
  return utf8Encode(JSON.stringify({ name: info.name.slice(0, 64), platform: info.platform.slice(0, 16) }))
}

function decodeDeviceInfo(payload: Uint8Array): DeviceInfo {
  try {
    const value = JSON.parse(utf8Decode(payload)) as Partial<DeviceInfo>
    const name = typeof value.name === 'string' ? value.name.slice(0, 64) : ''
    const platform = typeof value.platform === 'string' ? value.platform.slice(0, 16) : ''
    return { name, platform }
  } catch {
    return { name: '', platform: '' }
  }
}

/**
 * The established channel: encrypts one protocol message into one or more WebSocket messages, and
 * reassembles the ones it receives.
 */
export class ChannelSession {
  private pending: Uint8Array[] = []
  private pendingLength = 0

  constructor(
    private readonly sendCipher: CipherState,
    private readonly receiveCipher: CipherState,
    readonly handshakeHash: Uint8Array,
    readonly remoteStatic: Uint8Array,
    private readonly maxMessage = MAX_CHANNEL_MESSAGE,
  ) {}

  static from(result: HandshakeResult, maxMessage?: number): ChannelSession {
    return new ChannelSession(
      result.send,
      result.receive,
      result.handshakeHash,
      result.remoteStatic,
      maxMessage,
    )
  }

  /** Encrypts a protocol message (already serialized) into the WebSocket messages to send in order. */
  seal(message: Uint8Array): Uint8Array[] {
    if (message.length > this.maxMessage) throw new NoiseError('message too large')
    const frames: Uint8Array[] = []
    let offset = 0
    do {
      const chunk = message.subarray(offset, offset + MAX_CHUNK)
      offset += chunk.length
      const flag = offset < message.length ? FLAG_MORE : FLAG_LAST
      frames.push(this.sendCipher.encryptWithAd(new Uint8Array(0), concatBytes(Uint8Array.of(flag), chunk)))
    } while (offset < message.length)
    return frames
  }

  sealText(text: string): Uint8Array[] {
    return this.seal(utf8Encode(text))
  }

  /**
   * Decrypts one WebSocket message; returns the whole protocol message on its last chunk, null while
   * more chunks are expected. Throws NoiseError on a bad frame, a replay or an oversize message.
   */
  open(frame: Uint8Array): Uint8Array | null {
    if (frame.length > MAX_NOISE_MESSAGE) throw new NoiseError('transport message too long')
    const plaintext = this.receiveCipher.decryptWithAd(new Uint8Array(0), frame)
    const flag = plaintext[0]
    if (flag !== FLAG_LAST && flag !== FLAG_MORE) throw new NoiseError('bad chunk flag')
    const chunk = plaintext.subarray(1)
    this.pendingLength += chunk.length
    if (this.pendingLength > this.maxMessage) throw new NoiseError('message too large')
    this.pending.push(chunk)
    if (flag === FLAG_MORE) return null
    const message = this.pending.length === 1 ? (this.pending[0] as Uint8Array) : concatBytes(...this.pending)
    this.pending = []
    this.pendingLength = 0
    return message
  }

  openText(frame: Uint8Array): string | null {
    const message = this.open(frame)
    return message === null ? null : utf8Decode(message)
  }
}

export type DeviceHandshakeStep = {
  /** Send these bytes to the daemon. */
  send?: Uint8Array
  /** Set once the channel is established. */
  session?: ChannelSession
}

/**
 * The device's side (initiator). `pair` runs XXpsk3 with the code's secret and checks the daemon's
 * static key; `reconnect` runs IK with the saved keys.
 */
export class DeviceHandshake {
  private readonly state: HandshakeState
  private readonly prefaceBytes: Uint8Array

  private constructor(
    crypto: NoiseCrypto,
    preface: Preface,
    options: { deviceKey: KeyPair; daemonKey: Uint8Array; psk?: Uint8Array; ephemeral?: KeyPair },
    private readonly expectedDaemonKey: Uint8Array,
    private readonly info: DeviceInfo | null,
  ) {
    this.prefaceBytes = encodePreface(preface)
    this.state = new HandshakeState(crypto, {
      pattern: preface.mode === 'reconnect' ? 'IK' : 'XXpsk3',
      initiator: true,
      prologue: channelPrologue(this.prefaceBytes),
      staticKey: options.deviceKey,
      ...(preface.mode === 'reconnect' ? { remoteStatic: options.daemonKey } : {}),
      ...(options.psk ? { psk: options.psk } : {}),
      ...(options.ephemeral ? { ephemeral: options.ephemeral } : {}),
    })
  }

  /**
   * Pairs with the code's secret and the confirmation code the computer shows (ADR-0009). Without
   * `confirmation` it speaks the old mode `0x01`, which daemons with confirmation codes refuse.
   */
  static pair(
    crypto: NoiseCrypto,
    options: {
      deviceKey: KeyPair
      daemonKey: Uint8Array
      secret: Uint8Array
      info: DeviceInfo
      confirmation?: string
    },
  ): DeviceHandshake {
    if (options.secret.length !== PAIRING_SECRET_LENGTH) throw new NoiseError('bad pairing secret')
    const pairingId = pairingIdOf(crypto, options.secret)
    const { confirmation } = options
    return new DeviceHandshake(
      crypto,
      { mode: confirmation === undefined ? 'legacy-pair' : 'pair', pairingId },
      {
        deviceKey: options.deviceKey,
        daemonKey: options.daemonKey,
        psk:
          confirmation === undefined ? options.secret : confirmationPsk(crypto, options.secret, confirmation),
      },
      options.daemonKey,
      options.info,
    )
  }

  static reconnect(
    crypto: NoiseCrypto,
    options: { deviceKey: KeyPair; daemonKey: Uint8Array },
  ): DeviceHandshake {
    return new DeviceHandshake(crypto, { mode: 'reconnect' }, options, options.daemonKey, null)
  }

  /** The first WebSocket message: the preface and the first handshake message. */
  start(): Uint8Array {
    return concatBytes(this.prefaceBytes, this.state.writeMessage())
  }

  /** Handles a daemon handshake message. Throws NoiseError when the daemon is not the expected one. */
  receive(message: Uint8Array): DeviceHandshakeStep {
    this.state.readMessage(message)
    const remote = this.state.remoteStatic
    if (!remote || !equalBytes(remote, this.expectedDaemonKey)) throw new NoiseError('unexpected daemon key')
    if (this.state.complete) return { session: ChannelSession.from(this.state.handshakeResult) }
    // XXpsk3: answer with our static key, the PSK and our name.
    const send = this.state.writeMessage(encodeDeviceInfo(this.info ?? { name: '', platform: '' }))
    return { send, session: ChannelSession.from(this.state.handshakeResult) }
  }
}

export type DaemonHandshakeHooks = {
  /** The secret of a live pairing code, or null when the code is unknown, used or expired. */
  pairingSecret(pairingId: Uint8Array): Uint8Array | null
  /**
   * The confirmation code shown for a live pairing code, or null while no device announced it.
   * Absent (tests that never pair): every pairing is an announce, so none completes.
   */
  pairingConfirmation?(pairingId: Uint8Array): string | null
  /** True when the key belongs to a paired device. */
  isPaired(deviceKey: Uint8Array): boolean
}

export type DaemonHandshakeStep =
  | { kind: 'send'; send: Uint8Array; session?: ChannelSession }
  | { kind: 'paired'; session: ChannelSession; pairingId: Uint8Array; device: DeviceInfo }
  /** A device presented a live code: show its confirmation code and close with 4011. */
  | { kind: 'announce'; pairingId: Uint8Array }
  /** The third message did not decrypt: another confirmation code (an attempt to count). */
  | { kind: 'wrong-confirmation'; pairingId: Uint8Array }
  | { kind: 'refused'; code: number; reason: string }

/** The daemon's side (responder): created from the device's first message. */
export class DaemonHandshake {
  private state: HandshakeState | null = null
  private preface: Preface | null = null

  constructor(
    private readonly crypto: NoiseCrypto,
    private readonly staticKey: KeyPair,
    private readonly hooks: DaemonHandshakeHooks,
  ) {}

  /** Reads the first message (preface + handshake) and answers the second handshake message. */
  start(first: Uint8Array, ephemeral?: KeyPair): DaemonHandshakeStep {
    const decoded = decodePreface(first)
    if (!decoded.ok) return { kind: 'refused', code: CHANNEL_CLOSE.protocolMismatch, reason: decoded.reason }
    const preface = decoded.preface
    this.preface = preface
    if (preface.mode === 'legacy-pair')
      return {
        kind: 'refused',
        code: CHANNEL_CLOSE.protocolMismatch,
        reason: 'pairing needs a confirmation code: update the app',
      }
    let psk: Uint8Array | undefined
    if (preface.mode === 'pair' || preface.mode === 'announce') {
      const secret = this.hooks.pairingSecret(preface.pairingId)
      if (!secret)
        return { kind: 'refused', code: CHANNEL_CLOSE.pairingRefused, reason: 'unknown pairing code' }
      const confirmation = this.hooks.pairingConfirmation?.(preface.pairingId) ?? null
      // Nothing to type yet: this presentation is what shows the code on the computer.
      if (preface.mode === 'announce' || confirmation === null)
        return { kind: 'announce', pairingId: preface.pairingId }
      psk = confirmationPsk(this.crypto, secret, confirmation)
    }
    try {
      this.state = new HandshakeState(this.crypto, {
        pattern: preface.mode === 'pair' ? 'XXpsk3' : 'IK',
        initiator: false,
        prologue: channelPrologue(decoded.prefaceBytes),
        staticKey: this.staticKey,
        ...(psk ? { psk } : {}),
        ...(ephemeral ? { ephemeral } : {}),
      })
      this.state.readMessage(decoded.rest)
      if (preface.mode === 'reconnect') {
        const device = this.state.remoteStatic
        if (!device || !this.hooks.isPaired(device))
          return { kind: 'refused', code: CHANNEL_CLOSE.unauthorized, reason: 'unknown device' }
      }
      const send = this.state.writeMessage()
      return this.state.complete
        ? { kind: 'send', send, session: ChannelSession.from(this.state.handshakeResult) }
        : { kind: 'send', send }
    } catch (error) {
      return { kind: 'refused', code: CHANNEL_CLOSE.unauthorized, reason: (error as Error).message }
    }
  }

  /** Reads the third XXpsk3 message: a wrong PSK fails here. */
  finish(message: Uint8Array): DaemonHandshakeStep {
    const state = this.state
    const preface = this.preface
    if (!state || preface?.mode !== 'pair' || state.complete)
      return { kind: 'refused', code: CHANNEL_CLOSE.unauthorized, reason: 'unexpected handshake message' }
    try {
      const payload = state.readMessage(message)
      return {
        kind: 'paired',
        session: ChannelSession.from(state.handshakeResult),
        pairingId: preface.pairingId,
        device: decodeDeviceInfo(payload),
      }
    } catch {
      // The secret matched the pairing ID, so a third message that does not decrypt was sealed
      // with another confirmation code (or tampered with): either way, one attempt.
      return { kind: 'wrong-confirmation', pairingId: preface.pairingId }
    }
  }
}
