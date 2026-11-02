/**
 * Composes the raw store captures (`store:screenshots`) onto the store canvases: a dark background
 * with a glow at the top, the scene's caption in JetBrains Mono (first word in amber) and the
 * capture inside a rounded device frame that bleeds off the bottom. One PNG without alpha per
 * capture, the size App Store Connect and the Play Console take for that device class.
 *
 *   pnpm store:compose -- --platform ios [--locales en-US,pt-BR] [--captions <copy.mjs>] [--in <dir>] [--out <dir>]
 *
 * Captions come from the publishing sheet's `copy.mjs` (`export const CAPTIONS`, scene → locale →
 * text), outside the repository by default. Scenes are read from the file names
 * (`<device>-<nn>-<scene>.png`); a tablet capture takes the tablet caption whatever its scene.
 *
 * Canvases: iPhone 6.9" 1320 × 2868; iPad 13" 2064 × 2752 (2752 × 2064 landscape); Play phone
 * 1080 × 1920; Play tablet 1600 × 2560 (2560 × 1600 landscape).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import opentype, { type Font } from 'opentype.js'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..', '..')
const require = createRequire(import.meta.url)

const BG = '#0D0D0D'
const GLOW = '#1B1B1B'
const TEXT = '#E8E6E3'
const ACCENT = '#E8A33D'
const FRAME = '#333333'
const LOCALES = ['en-US', 'pt-BR', 'es-ES']

type Platform = 'ios' | 'android'
type Captions = Record<string, Record<string, string>>

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const platform = (arg('platform') ?? 'ios') as Platform
if (platform !== 'ios' && platform !== 'android') fail('--platform ios|android')
const locales = arg('locales')?.split(',') ?? LOCALES
const input = resolve(arg('in') ?? join(here, '..', 'store', 'screenshots', platform))
const output = resolve(arg('out') ?? join(here, '..', 'store', 'screenshots', `${platform}-composed`))
const captionsFile = resolve(arg('captions') ?? join(repo, '.annotations', 'publishing', 'src', 'copy.mjs'))
if (!existsSync(captionsFile)) fail(`captions not found: ${captionsFile} (--captions <copy.mjs>)`)
const { CAPTIONS } = (await import(pathToFileURL(captionsFile).href)) as { CAPTIONS: Captions }

// --- Text in JetBrains Mono, as outlines (the same fonts the app ships) ---------------------------

const fontsDir = dirname(require.resolve('@expo-google-fonts/jetbrains-mono/package.json'))
function loadFont(file: string): Font {
  const bytes = readFileSync(join(fontsDir, file))
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}
const BOLD = loadFont(join('700Bold', 'JetBrainsMono_700Bold.ttf'))

// Glyph by glyph, with the font's own advances (it is monospaced): `font.getPath` on a whole string
// runs the layout tables and, for some sequences, leaves undefined coordinates that turn into NaN
// in the path data, which cuts the caption short when rendered.
const advance = (ch: string, size: number) =>
  ((BOLD.charToGlyph(ch).advanceWidth ?? 0) * size) / BOLD.unitsPerEm
const width = (text: string, size: number) => [...text].reduce((w, ch) => w + advance(ch, size), 0)
function glyphs(text: string, size: number, color: string, x: number, y: number): string {
  let cx = x
  const parts: string[] = []
  for (const ch of text) {
    // Outlined at the origin and moved with a transform: at other offsets some glyphs come out NaN.
    const d = BOLD.charToGlyph(ch).getPath(0, 0, size).toPathData(2)
    if (d && !d.includes('NaN'))
      parts.push(`<path d="${d}" fill="${color}" transform="translate(${cx.toFixed(2)} ${y.toFixed(2)})"/>`)
    cx += advance(ch, size)
  }
  return parts.join('')
}

/** Greedy word wrap within `max` pixels. */
function wrap(text: string, size: number, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word
    if (line && width(candidate, size) > max) {
      lines.push(line)
      line = word
    } else line = candidate
  }
  if (line) lines.push(line)
  return lines
}

/** The caption on up to two lines (the size shrinks until it fits), the first word in amber. */
function caption(
  text: string,
  box: number,
  size: number,
  x: number,
  y: number,
): { svg: string; height: number } {
  let fontSize = size
  let lines = wrap(text, fontSize, box)
  while (lines.length > 2 && fontSize > size * 0.6) {
    fontSize = Math.round(fontSize * 0.94)
    lines = wrap(text, fontSize, box)
  }
  const lineHeight = fontSize * 1.3
  const parts: string[] = []
  lines.forEach((line, i) => {
    const baseline = y + fontSize + i * lineHeight
    if (i === 0) {
      const [first, ...rest] = line.split(' ')
      const firstWord = first ?? line
      parts.push(glyphs(firstWord, fontSize, ACCENT, x, baseline))
      if (rest.length)
        parts.push(glyphs(` ${rest.join(' ')}`, fontSize, TEXT, x + width(firstWord, fontSize), baseline))
    } else parts.push(glyphs(line, fontSize, TEXT, x, baseline))
  })
  return { svg: parts.join(''), height: lines.length * lineHeight }
}

// --- Canvases -------------------------------------------------------------------------------------

type Shape = { width: number; height: number; tablet: boolean; landscape: boolean }

/** The store canvas for a capture: by platform, phone/tablet (aspect) and orientation. */
function canvasFor(w: number, h: number): Shape {
  const landscape = w > h
  const ratio = Math.min(w, h) / Math.max(w, h)
  const tablet = ratio > 0.6
  if (platform === 'ios') {
    if (!tablet) return { width: 1320, height: 2868, tablet, landscape: false }
    return landscape
      ? { width: 2752, height: 2064, tablet, landscape }
      : { width: 2064, height: 2752, tablet, landscape }
  }
  if (!tablet) return { width: 1080, height: 1920, tablet, landscape: false }
  return landscape
    ? { width: 2560, height: 1600, tablet, landscape }
    : { width: 1600, height: 2560, tablet, landscape }
}

/** Which caption a file gets: the tablet one for tablets, else by the scene in its name. */
function captionKey(file: string, tablet: boolean): string {
  if (tablet) return platform === 'ios' ? 'tabletIos' : 'tabletAndroid'
  const scene = /-\d+[a-z]?-([a-z-]+)\.png$/i.exec(file)?.[1] ?? ''
  const byScene: Record<string, string> = {
    sessions: 'sessions',
    permission: 'permission',
    conversation: 'conversation',
    prompt: 'prompt',
    'hands-free': 'prompt',
    terminal: 'terminal',
    live: platform === 'ios' ? 'liveIos' : 'liveAndroid',
    'new-session': 'newSession',
    settings: 'settings',
  }
  return byScene[scene] ?? fail(`no caption for scene "${scene}" (${file})`)
}

async function compose(file: string, locale: string, out: string): Promise<void> {
  const image = sharp(file)
  const meta = await image.metadata()
  const w = meta.width ?? fail(`no size: ${file}`)
  const h = meta.height ?? fail(`no size: ${file}`)
  const canvas = canvasFor(w, h)
  const text = CAPTIONS[captionKey(file, canvas.tablet)]?.[locale] ?? fail(`no ${locale} caption for ${file}`)

  const W = canvas.width
  const H = canvas.height
  const side = Math.round(W * 0.08)
  const top = Math.round(H * (canvas.landscape ? 0.07 : 0.09))
  const box = W - side * 2
  const fontSize = Math.round(Math.min(W, H) * (canvas.tablet ? 0.03 : 0.034))
  const cap = caption(text, box, fontSize, side, top)
  const gap = Math.round(H * (canvas.landscape ? 0.05 : 0.06))
  const frameTop = Math.round(top + Math.max(cap.height, fontSize * 1.3 * 2) + gap)
  const frameWidth = box
  const radius = Math.round(frameWidth * (canvas.tablet ? 0.025 : 0.1))
  const border = Math.max(2, Math.round(W / 440))

  // The capture at the frame's width, top aligned, cut by the canvas bottom.
  const scale = frameWidth / w
  const shotHeight = Math.round(h * scale)
  const visible = Math.min(shotHeight, H - frameTop)
  const shot = await image
    .resize({ width: frameWidth, height: shotHeight })
    .extract({ left: 0, top: 0, width: frameWidth, height: visible })
    .png()
    .toBuffer()

  const glowId = 'glow'
  const base = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="${glowId}" cx="50%" cy="0%" r="70%" fx="50%" fy="0%">
      <stop offset="0" stop-color="${GLOW}"/><stop offset="0.6" stop-color="${BG}"/>
    </radialGradient>
    <clipPath id="frame"><rect x="${side}" y="${frameTop}" width="${frameWidth}" height="${H - frameTop + radius}" rx="${radius}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#${glowId})"/>
  ${cap.svg}
</svg>`

  // Frame border drawn over the capture: a rounded rect open at the bottom (it continues off-canvas).
  const borderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="${side + border / 2}" y="${frameTop + border / 2}" width="${frameWidth - border}" height="${H - frameTop + radius}" rx="${radius}" fill="none" stroke="${FRAME}" stroke-width="${border}"/>
</svg>`

  // The capture clipped to the rounded frame: rendered on a transparent canvas, then placed.
  const clipped = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: shot, left: side, top: frameTop }])
    .png()
    .toBuffer()
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${side}" y="${frameTop}" width="${frameWidth}" height="${H - frameTop + radius}" rx="${radius}" fill="#fff"/></svg>`,
  )
  const framed = await sharp(clipped)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  mkdirSync(dirname(out), { recursive: true })
  await sharp(Buffer.from(base))
    .composite([
      { input: framed, left: 0, top: 0 },
      { input: Buffer.from(borderSvg), left: 0, top: 0 },
    ])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log(`✓ ${locale} ${out.split('/').pop()} ${W}×${H}`)
}

for (const locale of locales) {
  const dir = join(input, locale)
  if (!existsSync(dir)) {
    console.log(`  ${locale}: no captures in ${dir}`)
    continue
  }
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort()) {
    const name = file.replace(/\.png$/i, '')
    await compose(join(dir, file), locale, join(output, locale, `${name}.png`))
  }
}
console.log(`→ ${output}`)
