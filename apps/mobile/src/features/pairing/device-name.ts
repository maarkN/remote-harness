import { DEVICE_NAME_MAX } from '@remote-harness/protocol'
import { deviceInfo } from './parse-pairing-url'

/** What iOS 16+ reports as the device name without the user-assigned-name entitlement. */
const GENERIC_NAMES = new Set(['iphone', 'ipad', 'ipod touch'])

const trimmed = (value: string | null | undefined): string => (value ?? '').trim().slice(0, DEVICE_NAME_MAX)

/**
 * The name the name step starts with (#592): the name the user gave the device when the system
 * tells it, else the model ("iPhone 15 Pro", "Pixel 8"), else the platform default.
 */
export function suggestedDeviceName(device: {
  os: string
  isPad: boolean
  deviceName: string | null
  modelName: string | null
}): string {
  const name = trimmed(device.deviceName)
  if (name && !GENERIC_NAMES.has(name.toLowerCase())) return name
  return trimmed(device.modelName) || deviceInfo(device.os, device.isPad).name
}

/** The name `devices.rename` accepts (trimmed, 1–64 characters), or null. */
export function cleanDeviceName(name: string): string | null {
  const value = name.trim()
  return value.length > 0 && value.length <= DEVICE_NAME_MAX ? value : null
}
