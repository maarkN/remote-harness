import * as LocalAuthentication from 'expo-local-authentication'
import { canCheckIdentity } from './identity'

/**
 * Asks for the device's biometrics, falling back to its passcode. A device with no lock at all has
 * nothing to ask: the caller's confirmation alert is the only check, and this returns true.
 */
export async function confirmIdentity(promptMessage: string, cancelLabel: string): Promise<boolean> {
  try {
    if (!canCheckIdentity(await LocalAuthentication.getEnrolledLevelAsync())) return true
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel })
    return result.success
  } catch {
    return false
  }
}
