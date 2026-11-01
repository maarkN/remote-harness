/** Width and height, in pixels (an image) or in points (a view). */
export type Size = { width: number; height: number }

/**
 * Pixels the viewer decodes at most (about 64 MB of RGBA): plenty for a 5 MB image, safe on the
 * iPad 9th gen and the Redmi 8.
 */
export const MAX_DECODED_PIXELS = 16_000_000

/** How the viewer lays an image out: the size of its view, in points, and the scale that fits the stage. */
export type ImageFit = {
  width: number
  height: number
  /** Scale that makes the view fit the stage ("contain"); zoom multiplies it. */
  baseScale: number
}

/**
 * React Native decodes an image to the size of its view, so a view the size of the screen magnified by
 * a transform shows screen pixels, not image pixels. The viewer gives the image a view of its own pixel
 * size instead (points = pixels / pixel ratio, capped at `maxPixels`) and fits it to the stage with a
 * base scale, so pinch zoom stays sharp up to the source pixels. Null when a size is unknown or empty.
 */
export function fitImage(
  natural: Size | null,
  stage: Size | null,
  pixelRatio: number,
  maxPixels = MAX_DECODED_PIXELS,
): ImageFit | null {
  if (!natural || !stage || natural.width <= 0 || natural.height <= 0) return null
  if (stage.width <= 0 || stage.height <= 0 || pixelRatio <= 0) return null
  const pixels = natural.width * natural.height
  const cap = pixels > maxPixels ? Math.sqrt(maxPixels / pixels) : 1
  const width = (natural.width * cap) / pixelRatio
  const height = (natural.height * cap) / pixelRatio
  return { width, height, baseScale: Math.min(stage.width / width, stage.height / height) }
}
