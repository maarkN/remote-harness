/** Byte helpers without Buffer, so the same code runs in Node and in React Native. */

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let length = 0
  for (const part of parts) length += part.length
  const out = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) throw new Error('invalid hex')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(2 * i, 2 * i + 2), 16)
  return out
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const B64_INDEX = new Map([...B64].map((c, i) => [c, i]))

/** Unpadded base64url (RFC 4648 §5). */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]
    out += B64[(n >> 12) & 63]
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63]
    if (i + 2 < bytes.length) out += B64[n & 63]
  }
  return out
}

/** Decodes unpadded base64url; null when the text is not valid base64url. */
export function base64UrlToBytes(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null
  const out = new Uint8Array(Math.floor((text.length * 3) / 4))
  let bits = 0
  let value = 0
  let index = 0
  for (const char of text) {
    const digit = B64_INDEX.get(char)
    if (digit === undefined) return null
    value = (value << 6) | digit
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[index++] = (value >> bits) & 0xff
    }
  }
  // Leftover bits must be zero for the encoding to be canonical.
  if ((value & ((1 << bits) - 1)) !== 0) return null
  return out
}

// Typed here instead of through a DOM or Node lib: the package builds for both.
const runtime = globalThis as {
  TextEncoder?: new () => { encode(text: string): Uint8Array }
  TextDecoder?: new (label: string, options: { fatal: boolean }) => { decode(bytes: Uint8Array): string }
}
const encoder = runtime.TextEncoder ? new runtime.TextEncoder() : null
const decoder = runtime.TextDecoder ? new runtime.TextDecoder('utf-8', { fatal: true }) : null

export function utf8Encode(text: string): Uint8Array {
  if (encoder) return encoder.encode(text)
  const out: number[] = []
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x80) out.push(code)
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63))
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
    else
      out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
  }
  return Uint8Array.from(out)
}

/** Throws on invalid UTF-8. */
export function utf8Decode(bytes: Uint8Array): string {
  if (decoder) return decoder.decode(bytes)
  let out = ''
  for (let i = 0; i < bytes.length; ) {
    const a = bytes[i] ?? 0
    const extra = a < 0x80 ? 0 : a >= 0xf0 ? 3 : a >= 0xe0 ? 2 : a >= 0xc0 ? 1 : -1
    if (extra < 0 || i + extra > bytes.length - 1) throw new Error('invalid utf-8')
    let code = extra === 0 ? a : a & (0x3f >> extra)
    for (let j = 1; j <= extra; j++) {
      const next = bytes[i + j] ?? 0
      if ((next & 0xc0) !== 0x80) throw new Error('invalid utf-8')
      code = (code << 6) | (next & 63)
    }
    out += String.fromCodePoint(code)
    i += extra + 1
  }
  return out
}
