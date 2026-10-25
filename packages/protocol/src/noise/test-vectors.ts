import { bytesToHex, hexToBytes } from './bytes.ts'
import type { NoiseCrypto } from './crypto.ts'
import { HandshakeState, type PatternName } from './handshake.ts'

type Vector = {
  readonly protocol_name: string
  readonly init_prologue: string
  readonly resp_prologue?: string
  readonly init_static: string
  readonly init_ephemeral: string
  readonly init_remote_static?: string
  readonly init_psks?: readonly string[]
  readonly resp_static: string
  readonly resp_ephemeral: string
  readonly resp_psks?: readonly string[]
  readonly handshake_hash: string
  readonly messages: readonly { readonly payload: string; readonly ciphertext: string }[]
}

/**
 * Runs one official test vector through our handshake and transport with the given primitives:
 * every ciphertext and the handshake hash must match byte for byte. Returns the mismatches (empty
 * when the vector passes), so each app's test suite can run it with its own crypto adapter.
 */
export function runNoiseVector(crypto: NoiseCrypto, vector: Vector): string[] {
  const pattern = vector.protocol_name.split('_')[1] as PatternName
  const keyPair = (privateHex: string) => {
    const privateKey = hexToBytes(privateHex)
    return { privateKey, publicKey: crypto.publicKey(privateKey) }
  }
  const respStatic = keyPair(vector.resp_static)
  const initiator = new HandshakeState(crypto, {
    pattern,
    initiator: true,
    prologue: hexToBytes(vector.init_prologue),
    staticKey: keyPair(vector.init_static),
    ephemeral: keyPair(vector.init_ephemeral),
    ...(vector.init_remote_static ? { remoteStatic: hexToBytes(vector.init_remote_static) } : {}),
    ...(vector.init_psks?.[0] ? { psk: hexToBytes(vector.init_psks[0]) } : {}),
  })
  const responder = new HandshakeState(crypto, {
    pattern,
    initiator: false,
    prologue: hexToBytes(vector.init_prologue),
    staticKey: respStatic,
    ephemeral: keyPair(vector.resp_ephemeral),
    ...(vector.resp_psks?.[0] ? { psk: hexToBytes(vector.resp_psks[0]) } : {}),
  })
  const errors: string[] = []
  vector.messages.forEach((message, index) => {
    const fromInitiator = index % 2 === 0
    const payload = hexToBytes(message.payload)
    let ciphertext: Uint8Array
    let received: Uint8Array
    if (!initiator.complete) {
      const [writer, reader] = fromInitiator ? [initiator, responder] : [responder, initiator]
      ciphertext = writer.writeMessage(payload)
      received = reader.readMessage(ciphertext)
    } else {
      const sender = fromInitiator ? initiator.handshakeResult.send : responder.handshakeResult.send
      const receiver = fromInitiator ? responder.handshakeResult.receive : initiator.handshakeResult.receive
      ciphertext = sender.encryptWithAd(new Uint8Array(0), payload)
      received = receiver.decryptWithAd(new Uint8Array(0), ciphertext)
    }
    if (bytesToHex(ciphertext) !== message.ciphertext) errors.push(`message ${index}: ciphertext differs`)
    if (bytesToHex(received) !== message.payload) errors.push(`message ${index}: payload differs`)
  })
  const hash = bytesToHex(initiator.handshakeResult.handshakeHash)
  if (hash !== vector.handshake_hash) errors.push('initiator handshake hash differs')
  if (bytesToHex(responder.handshakeResult.handshakeHash) !== vector.handshake_hash)
    errors.push('responder handshake hash differs')
  return errors
}

/** Official Noise test vectors (cacophony, github.com/haskell-cryptography/cacophony, vectors/cacophony.txt) for the two patterns Remote Harness uses. Hex strings. */
export const NOISE_TEST_VECTORS: readonly Vector[] = [
  {
    protocol_name: 'Noise_IK_25519_ChaChaPoly_SHA256',
    init_prologue: '4a6f686e2047616c74',
    init_static: 'e61ef9919cde45dd5f82166404bd08e38bceb5dfdfded0a34c8df7ed542214d1',
    init_ephemeral: '893e28b9dc6ca8d611ab664754b8ceb7bac5117349a4439a6b0569da977c464a',
    init_remote_static: '31e0303fd6418d2f8c0e78b91f22e8caed0fbe48656dcf4767e4834f701b8f62',
    resp_prologue: '4a6f686e2047616c74',
    resp_static: '4a3acbfdb163dec651dfa3194dece676d437029c62a408b4c5ea9114246e4893',
    resp_ephemeral: 'bbdb4cdbd309f1a1f2e1456967fe288cadd6f712d65dc7b7793d5e63da6b375b',
    handshake_hash: '0b0f68fb0c27e03ce9b97565995ed4838cc0581b762ef72b062f6a546419fad7',
    messages: [
      {
        payload: '4c756477696720766f6e204d69736573',
        ciphertext:
          'ca35def5ae56cec33dc2036731ab14896bc4c75dbb07a61f879f8e3afa4c7944718da798efbcd91528520204f904b9bd6c7413dccdc214d951e15253e39987f18146e8cd0873654207148333479d4d16c289f0294b29960a72f48e0b7bba2e89083169825e59642148d492020664ccf7',
      },
      {
        payload: '4d757272617920526f746862617264',
        ciphertext:
          '95ebc60d2b1fa672c1f46a8aa265ef51bfe38e7ccb39ec5be34069f1448088435361e70b2ed446e6c9ec387d1d6b3b840f194e373979d241b203c4acafccf5',
      },
      {
        payload: '462e20412e20486179656b',
        ciphertext: '050e9f3c8fac16b68dbce8f8c4bfbf6617c897f9ada4aa29aa19c8',
      },
      {
        payload: '4361726c204d656e676572',
        ciphertext: '344233a6cabb7141d80f3da2fedc311d9646bbb0f505afe403a667',
      },
      {
        payload: '4a65616e2d426170746973746520536179',
        ciphertext: '62cdeeb172ad7ade7aa7d9e069da5790f12331bfa00177787a1d0810c67dc3b2b4',
      },
      {
        payload: '457567656e2042f6686d20766f6e2042617765726b',
        ciphertext: '029bead1b40992327044d409d9a1f3ad8f36c3c452775d557e18bbeb2e8dfcead32d514024',
      },
    ],
  },
  {
    protocol_name: 'Noise_XXpsk3_25519_ChaChaPoly_SHA256',
    init_prologue: '4a6f686e2047616c74',
    init_psks: ['54686973206973206d7920417573747269616e20706572737065637469766521'],
    init_static: 'e61ef9919cde45dd5f82166404bd08e38bceb5dfdfded0a34c8df7ed542214d1',
    init_ephemeral: '893e28b9dc6ca8d611ab664754b8ceb7bac5117349a4439a6b0569da977c464a',
    resp_prologue: '4a6f686e2047616c74',
    resp_psks: ['54686973206973206d7920417573747269616e20706572737065637469766521'],
    resp_static: '4a3acbfdb163dec651dfa3194dece676d437029c62a408b4c5ea9114246e4893',
    resp_ephemeral: 'bbdb4cdbd309f1a1f2e1456967fe288cadd6f712d65dc7b7793d5e63da6b375b',
    handshake_hash: 'a477edf6a131bbdb54707f6ea30eab6cd935d9b560f0e5fd1f053a95a99669fb',
    messages: [
      {
        payload: '4c756477696720766f6e204d69736573',
        ciphertext:
          'ca35def5ae56cec33dc2036731ab14896bc4c75dbb07a61f879f8e3afa4c7944c9f5ff0e8079630cb7e270c20bbf480821b77a384a645c71a2fd9b3db1c16a5f',
      },
      {
        payload: '4d757272617920526f746862617264',
        ciphertext:
          '95ebc60d2b1fa672c1f46a8aa265ef51bfe38e7ccb39ec5be34069f144808843b123def17f71e6ae8e57e0e1dec5949c5f7415c6f33517398747d821a06dc23ad430aa1fd7381d46195c378a819fd574425462cbb2d4ca339e738a0b7001dc91423fbf55a99af0c6f1df21012ceb2f',
      },
      {
        payload: '462e20412e20486179656b',
        ciphertext:
          '52187316111b118d4c060364f7b975dc0809b2590779aff2d63113c564f11744493384db7bf32d5ae6686df6ab06d508d2e07caaf1d6afc010b978735fc78900e71ae1d314130d042e729a',
      },
      {
        payload: '4361726c204d656e676572',
        ciphertext: 'eaedc672d4c21e0e2955758756fb98f194c4e90d5deb5b6cf30b27',
      },
      {
        payload: '4a65616e2d426170746973746520536179',
        ciphertext: '522d543c5fe799d09a3d9da7ff54d0dc03c8af1dc7751d2ff708339d2290943e98',
      },
      {
        payload: '457567656e2042f6686d20766f6e2042617765726b',
        ciphertext: '7d4e2c3873eef6a213b04e72f9df60a91666072d3544c5d96c34a09e2329b5030bee796741',
      },
    ],
  },
]
