/** One accelerometer sample, in g on each axis (`expo-sensors`). */
export type Acceleration = { x: number; y: number; z: number }

export type ShakeOptions = {
  /** Peak acceleration, in g (gravity alone is 1 g). */
  threshold: number
  /** Peaks that make a shake… */
  peaks: number
  /** …within this window. */
  windowMs: number
  /** Samples closer than this belong to the same peak. */
  peakGapMs: number
  /** Quiet time after a shake. */
  cooldownMs: number
}

export const SHAKE: ShakeOptions = {
  threshold: 2.3,
  peaks: 3,
  windowMs: 1000,
  peakGapMs: 80,
  cooldownMs: 3000,
}

/**
 * Feeds accelerometer samples; returns true on the sample that completes a shake (#557): a few
 * strong peaks close together, so walking or setting the phone down does not count.
 */
export function createShakeDetector(
  options: ShakeOptions = SHAKE,
): (sample: Acceleration, at: number) => boolean {
  let peaks: number[] = []
  let lastShake = Number.NEGATIVE_INFINITY
  return ({ x, y, z }, at) => {
    if (Math.sqrt(x * x + y * y + z * z) < options.threshold) return false
    if (at - lastShake < options.cooldownMs) return false
    const last = peaks.at(-1)
    if (last !== undefined && at - last < options.peakGapMs) return false
    peaks = [...peaks.filter((peak) => at - peak < options.windowMs), at]
    if (peaks.length < options.peaks) return false
    peaks = []
    lastShake = at
    return true
  }
}
