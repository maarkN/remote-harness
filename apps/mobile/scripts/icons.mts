/**
 * Generates the brand assets from code so the artwork stays reviewable and reproducible. One mark,
 * "Cursor Signal" (a terminal cursor block with the `>` prompt cut out of it and three signal arcs
 * leaving it to the right, see docs/design/identity/branding), in two weights: regular for the app
 * icon, splash and banner; bold under 24 px (notification, favicon, Live Activity, tray). Outputs:
 * `assets/*.png` + `assets/icon/*.svg` (app), the agent badges of the Live Activity in
 * `assets/live-activity/`, the Linux tray glyph next to `tray.py`, `docs/brand/og.png` (README
 * header, Open Graph) and the Google Play feature graphic in `store/`.
 * Run: pnpm --filter @remote-harness/mobile icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype, { type Font } from 'opentype.js'
import sharp from 'sharp'
import { CLAUDE_PATH } from '../src/ui/agent-icons/paths.ts'

const here = dirname(fileURLToPath(import.meta.url))
const assets = join(here, '..', 'assets')
const repo = join(here, '..', '..', '..')
const brand = join(repo, 'docs', 'brand')
const linuxTray = join(repo, 'apps', 'daemon', 'tray', 'linux')
const store = join(here, '..', 'store')

// Dark theme and brand colors (apps/mobile/src/core/theme/palettes.ts, agents.ts).
const ACCENT = '#E8A33D'
const BG = '#0D0D0D'
/** The warm dark the mark sits on: the icon container (flat) and the top of the banner gradient. */
const CONTAINER = '#1C1A17'
/** The light container of the sheet's light variant. */
const LIGHT_CONTAINER = '#F4F1EC'
const TEXT = '#E8E6E3'
const MUTED = '#8A8784'
const BORDER_STRONG = '#3A3836'
const INK = '#1A1206'
const WHITE = '#FFFFFF'
/** Standard fill of GTK symbolic icons, recolored by the theme. */
const SYMBOLIC = '#BEBEBE'
const AGENTS = { claude: '#D97757', codex: '#2FBF8F' } as const

type Weight = 'regular' | 'bold'

/**
 * Geometry of the mark in a 256 × 256 box (docs/design/identity/branding/icon.svg): the cursor block
 * is 76 × 136 at (26, 60), rx 15, with the `>` cut out by a round stroke; the three arcs are
 * concentric on the block's right edge (102, 128), radii 36 / 76 / 116, ±40°. The bold weight widens
 * the cutout and the arcs so neither closes up under 24 px.
 */
const MARK: Record<Weight, { cutout: number; arcs: number }> = {
  regular: { cutout: 18, arcs: 22 },
  bold: { cutout: 26, arcs: 28 },
}
const CUTOUT = 'M47 99L81 128L47 157'
const ARCS = [
  'M129.6 104.9A36 36 0 0 1 129.6 151.1',
  'M160.2 79.1A76 76 0 0 1 160.2 176.9',
  'M190.9 53.4A116 116 0 0 1 190.9 202.6',
]

/**
 * The mark drawn in its 256 box: the block with the prompt cut out of it, then the arcs. `id` keeps
 * the cutout masks apart when one document draws the mark more than once.
 */
function mark(weight: Weight, color: string, id: string = weight): string {
  const m = MARK[weight]
  const maskId = `cursor-${id}`
  const mask = `<mask id="${maskId}"><rect width="256" height="256" fill="#fff"/><path d="${CUTOUT}" fill="none" stroke="#000" stroke-width="${m.cutout}" stroke-linecap="round" stroke-linejoin="round"/></mask>`
  const block = `<rect x="26" y="60" width="76" height="136" rx="15" fill="${color}" mask="url(#${maskId})"/>`
  const arcs = `<g fill="none" stroke="${color}" stroke-width="${m.arcs}" stroke-linecap="round">${ARCS.map((d) => `<path d="${d}"/>`).join('')}</g>`
  return `<defs>${mask}</defs>${block}${arcs}`
}

/** The mark scaled into a `size` box whose top-left corner is (x, y). */
function markAt(weight: Weight, color: string, x: number, y: number, size: number, id?: string): string {
  return `<g transform="translate(${x} ${y}) scale(${(size / 256).toFixed(4)})">${mark(weight, color, id)}</g>`
}

function svg(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
}

/** Dark vertical gradient behind the banner's mark — flat, no glow (keeps the mark crisp). */
function backdrop(id: string): { defs: string; rects: string } {
  return {
    defs: `<linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CONTAINER}"/><stop offset="1" stop-color="${BG}"/></linearGradient>`,
    rects: `<rect width="100%" height="100%" fill="url(#${id}-bg)"/>`,
  }
}

/** Standalone mark, for the SVG sources and the docs. */
const markSvg = (weight: Weight, color = ACCENT) => svg(256, 256, mark(weight, color))

/**
 * The mark in a 78 % box, centered on a flat container; `radius` rounds the container (22 % for the
 * favicon and the SVG sources; iOS and Android mask their icons themselves).
 */
function containerSvg(
  size: number,
  bg: string,
  color: string,
  weight: Weight = 'regular',
  radius = 0,
): string {
  const box = (size * 200) / 256
  const inset = (size - box) / 2
  return svg(
    size,
    size,
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>${markAt(weight, color, inset, inset, box)}`,
  )
}

/** App icon (iOS, macOS bundle, Live Activity): the amber mark on the flat warm dark, no gradient, no glow. */
const iconSvg = (weight: Weight = 'regular') => containerSvg(1024, CONTAINER, ACCENT, weight)

/** The four variants of the sheet, as 256-box sources with the 22 % corners. */
const VARIANTS = {
  icon: { bg: CONTAINER, mark: ACCENT },
  'icon-inverted': { bg: ACCENT, mark: CONTAINER },
  'icon-light': { bg: LIGHT_CONTAINER, mark: CONTAINER },
  'icon-mono': { bg: CONTAINER, mark: TEXT },
} as const

/** Android adaptive foreground: the mark inside the 66 % safe zone, background from app.config. */
function adaptiveForegroundSvg(color = ACCENT): string {
  const inset = (1024 * 18) / 108
  return svg(1024, 1024, markAt('regular', color, inset, inset, 1024 - 2 * inset))
}

/**
 * Background and accent of each theme that gets its own alternate app icon (#233), matching
 * `src/core/theme/palettes.ts` (duplicated here for the same reason as `ACCENT`/`BG` above: this
 * script runs in Node, outside the app's module graph).
 */
const ICON_THEMES = {
  dark: { bg: '#0D0D0D', accent: '#E8A33D' },
  light: { bg: '#F3F3F1', accent: '#E8A33D' },
  dracula: { bg: '#282A36', accent: '#BD93F9' },
  mocha: { bg: '#1E1E2E', accent: '#FAB387' },
  latte: { bg: '#E6E9EF', accent: '#FE640B' },
} as const

/** Bold mark in white on transparent: Android themed (monochrome) icon and the notification icon. */
function monochromeSvg(inset: number): string {
  return svg(1024, 1024, markAt('bold', WHITE, inset, inset, 1024 - 2 * inset))
}

/** Splash: the regular mark alone; Expo paints the dark background. */
const splashSvg = () => svg(1024, 1024, markAt('regular', ACCENT, 192, 192, 640))

/** Linux tray: symbolic SVG (themes recolor the standard gray), looked up by name next to tray.py. */
const symbolicSvg = () =>
  svg(
    22,
    22,
    `<title>Remote Harness</title><g transform="scale(${(22 / 256).toFixed(5)})">${mark('bold', SYMBOLIC)}</g>`,
  )

// --- Banner -------------------------------------------------------------------------------------

// The SVG renderer only knows the fonts installed on the machine, so banner texts are converted to
// outlines with opentype.js from the font files bundled with the app (JetBrains Mono).
const require = createRequire(import.meta.url)
const fontsDir = dirname(require.resolve('@expo-google-fonts/jetbrains-mono/package.json'))
function loadFont(file: string): Font {
  const bytes = readFileSync(join(fontsDir, file))
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}
const FONTS: Record<Weight, Font> = {
  regular: loadFont(join('400Regular', 'JetBrainsMono_400Regular.ttf')),
  bold: loadFont(join('700Bold', 'JetBrainsMono_700Bold.ttf')),
}

/**
 * Path data from the outline commands, two decimals. opentype's own `toPathData()` rounds through
 * exponent strings and turns some coordinates into `NaN`, which stops the rasterizer mid-glyph.
 */
function pathData(path: opentype.Path): string {
  const n = (value: number | undefined) => String(Math.round((value ?? 0) * 100) / 100)
  return path.commands
    .map((c) => {
      if (c.type === 'Z') return 'Z'
      if (c.type === 'Q') return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`
      if (c.type === 'C') return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`
      return `${c.type}${n(c.x)} ${n(c.y)}`
    })
    .join('')
}

/** A text run as a filled path, baseline at (x, y), `size` in pixels. */
function text(content: string, weight: Weight, size: number, color: string, x: number, y: number): string {
  const d = pathData(FONTS[weight].getPath(content, x, y, size, { kerning: true }))
  return `<path d="${d}" fill="${color}"/>`
}

const textWidth = (content: string, weight: Weight, size: number) =>
  FONTS[weight].getAdvanceWidth(content, size, { kerning: true })

/**
 * Small drawn glyphs for the banner's agent chips, replacing the `cl`/`cx` letter codes with
 * something closer to a mark while #226 (official brand assets) is still open. Drawn strokes and
 * dots, like the mark itself, rather than an imported logo.
 */
const AGENT_GLYPHS: Record<'claude' | 'codex', (color: string, cx: number, cy: number, r: number) => string> =
  {
    /** Three crossing strokes through the center. */
    claude: (color, cx, cy, r) =>
      `<g stroke="${color}" stroke-width="${(r / 3.4).toFixed(2)}" stroke-linecap="round">${[0, 60, 120]
        .map((deg) => {
          const rad = (deg * Math.PI) / 180
          const dx = r * Math.cos(rad)
          const dy = r * Math.sin(rad)
          return `<line x1="${(cx - dx).toFixed(2)}" y1="${(cy - dy).toFixed(2)}" x2="${(cx + dx).toFixed(2)}" y2="${(cy + dy).toFixed(2)}"/>`
        })
        .join('')}</g>`,
    /** Six dots around a ring. */
    codex: (color, cx, cy, r) =>
      Array.from({ length: 6 }, (_, i) => {
        const rad = (i * 60 * Math.PI) / 180
        const x = cx + r * 0.72 * Math.cos(rad)
        const y = cy + r * 0.72 * Math.sin(rad)
        return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r / 3.2).toFixed(2)}" fill="${color}"/>`
      }).join(''),
  }

/** Open Graph / README banner, 1200 × 630: mark, name, tagline and the agent chips. */
function bannerSvg(): string {
  const left = 392
  const parts = [
    text('Remote Harness', 'bold', 60, TEXT, left, 300),
    text('Follow and drive your coding agents from your phone.', 'regular', 25, MUTED, left, 354),
  ]

  // Chips: outline sized by the label, agent square with a drawn glyph instead of a letter code.
  const top = 404
  const height = 44
  const pad = 14
  const square = 24
  let x = left
  for (const item of [
    { label: 'Claude Code', agent: { glyph: AGENT_GLYPHS.claude, color: AGENTS.claude } },
    { label: 'Codex', agent: { glyph: AGENT_GLYPHS.codex, color: AGENTS.codex } },
    { label: '+ soon', agent: null },
  ]) {
    const lead = item.agent ? square + 10 : 0
    const width = Math.round(pad + lead + textWidth(item.label, 'regular', 23) + pad)
    const dash = item.agent ? '' : ' stroke-dasharray="6 5"'
    parts.push(
      `<rect x="${x}" y="${top}" width="${width}" height="${height}" rx="${height / 2}" fill="none" stroke="${BORDER_STRONG}" stroke-width="2"${dash}/>`,
    )
    if (item.agent) {
      const sx = x + pad
      const sy = top + (height - square) / 2
      parts.push(
        `<rect x="${sx}" y="${sy}" width="${square}" height="${square}" rx="6" fill="${item.agent.color}"/>`,
      )
      parts.push(item.agent.glyph(INK, sx + square / 2, sy + square / 2, square / 2 - 4))
    }
    parts.push(text(item.label, 'regular', 23, TEXT, x + pad + lead, top + 30))
    x += width + 14
  }

  const { defs, rects } = backdrop('og')
  return svg(
    1200,
    630,
    `<defs>${defs}</defs>${rects}${markAt('regular', ACCENT, 96, 183, 264)}${parts.join('')}`,
  )
}

/** Google Play feature graphic, 1024 × 500: the banner's composition without the chips. */
function featureGraphicSvg(): string {
  const left = 352
  const parts = [
    text('Remote Harness', 'bold', 54, TEXT, left, 232),
    text('Follow and drive your coding agents', 'regular', 21, MUTED, left, 280),
    text('from your phone.', 'regular', 21, MUTED, left, 312),
  ]
  const { defs, rects } = backdrop('fg')
  return svg(
    1024,
    500,
    `<defs>${defs}</defs>${rects}${markAt('regular', ACCENT, 84, 128, 244)}${parts.join('')}`,
  )
}

// --- Output -------------------------------------------------------------------------------------

async function render(source: string, file: string, size?: number, background?: string) {
  mkdirSync(dirname(file), { recursive: true })
  let image = sharp(Buffer.from(source))
  if (size) image = image.resize(size, size)
  if (background) image = image.flatten({ background })
  await image.png().toFile(file)
  console.log(`✓ ${file}`)
}

function write(file: string, source: string) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${source}\n`)
  console.log(`✓ ${file}`)
}

write(join(assets, 'icon', 'mark.svg'), markSvg('regular'))
write(join(assets, 'icon', 'mark-bold.svg'), markSvg('bold'))
for (const [name, variant] of Object.entries(VARIANTS)) {
  write(
    join(assets, 'icon', `${name}.svg`),
    containerSvg(256, variant.bg, variant.mark, 'regular', 256 * 0.22),
  )
}
write(join(assets, 'icon', 'splash.svg'), splashSvg())
write(join(linuxTray, 'remote-harness-symbolic.svg'), symbolicSvg())
await render(iconSvg(), join(assets, 'icon.png'), 1024, CONTAINER)
await render(splashSvg(), join(assets, 'splash-icon.png'), 1024)
// Favicon: bold, with the 22 % corners (browsers show the PNG as is).
await render(containerSvg(1024, CONTAINER, ACCENT, 'bold', 1024 * 0.22), join(assets, 'favicon.png'), 48)
// Live Activity header (48 pt @3x); small, since ActivityKit refuses large images.
await render(iconSvg('bold'), join(assets, 'live-activity-icon.png'), 144, CONTAINER)
await render(adaptiveForegroundSvg(), join(assets, 'adaptive-icon.png'), 1024)
await render(monochromeSvg((1024 * 24) / 108), join(assets, 'adaptive-icon-monochrome.png'), 1024)
await render(monochromeSvg(82), join(assets, 'notification-icon.png'), 96)
await render(bannerSvg(), join(brand, 'og.png'))
write(join(store, 'feature-graphic.svg'), featureGraphicSvg())
await render(featureGraphicSvg(), join(store, 'feature-graphic.png'))

// Alternate app icons, one per theme (#233); app.config.ts's expo-alternate-app-icons plugin wires
// them up, src/features/settings/app-icon-store.ts picks one by name at runtime.
for (const [theme, { bg, accent }] of Object.entries(ICON_THEMES)) {
  await render(containerSvg(1024, bg, accent), join(assets, 'app-icon', `${theme}.png`), 1024, bg)
  await render(adaptiveForegroundSvg(accent), join(assets, 'app-icon', `${theme}-foreground.png`), 1024)
}

// --- Agent badges for the Live Activity (#471) ---------------------------------------------------

/** Ink over an agent color, as `src/core/theme/agents.ts` (`AGENT_BADGE_INK`). */
const AGENT_BADGE_INK = '#0D0D0D'
/**
 * Each agent as the session list draws it (`src/ui/AgentBadge.tsx`): its fixed color (duplicated from
 * `src/core/theme/agents.ts`, like the colors above) under the app's 24-box icon for it
 * (`src/ui/agent-icons`; the non-Claude ones are the same neutral placeholders, see its README).
 */
const AGENT_BADGES: Record<string, { color: string; icon: string }> = {
  claude: { color: '#D97757', icon: `<path d="${CLAUDE_PATH}" fill="${AGENT_BADGE_INK}"/>` },
  codex: { color: '#2FBF8F', icon: `<path d="M12 4 L20 12 L12 20 L4 12 Z" fill="${AGENT_BADGE_INK}"/>` },
  gemini: {
    color: '#E3729E',
    icon: `<rect x="5" y="5" width="14" height="14" rx="3" fill="${AGENT_BADGE_INK}"/>`,
  },
  kimi: { color: '#5B9BF5', icon: `<path d="M12 4 L20 19 L4 19 Z" fill="${AGENT_BADGE_INK}"/>` },
  qwen: {
    color: '#8C6CF5',
    icon: `<path d="M12 3 L19.8 7.5 L19.8 16.5 L12 21 L4.2 16.5 L4.2 7.5 Z" fill="${AGENT_BADGE_INK}"/>`,
  },
}

/** The badge: a square with corners of a quarter of its size and the icon at 60 % of it, centered. */
function agentBadgeSvg(color: string, icon: string): string {
  const size = 256
  const iconSize = size * 0.6
  const inset = (size - iconSize) / 2
  return svg(
    size,
    size,
    `<rect width="${size}" height="${size}" rx="${size / 4}" fill="${color}"/><g transform="translate(${inset} ${inset}) scale(${(iconSize / 24).toFixed(4)})">${icon}</g>`,
  )
}

// 144 px like the Live Activity mark; app.config.ts copies them into the widget's asset catalog.
for (const [id, badge] of Object.entries(AGENT_BADGES)) {
  await render(agentBadgeSvg(badge.color, badge.icon), join(assets, 'live-activity', `agent-${id}.png`), 144)
}
