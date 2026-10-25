import { createNoiseCrypto, type NodeLikeCrypto, type NoiseCrypto } from '@remote-harness/protocol'
import QuickCrypto from 'react-native-quick-crypto'

/**
 * Noise primitives on native code (OpenSSL through JSI): `react-native-quick-crypto` has Node's
 * `crypto` API, so the adapter is the same one the daemon uses with `node:crypto`.
 */
export const noiseCrypto: NoiseCrypto = createNoiseCrypto(QuickCrypto as unknown as NodeLikeCrypto)
