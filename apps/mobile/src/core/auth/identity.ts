/**
 * Whether the device can check who is holding it: any lock (passcode or biometrics) means yes.
 * Mirrors `expo-local-authentication`'s `SecurityLevel` (NONE = 0) without importing the native module.
 */
export function canCheckIdentity(securityLevel: number): boolean {
  return securityLevel > 0
}
