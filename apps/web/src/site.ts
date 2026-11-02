import { DOC_SLUGS, docPath } from './docs/content.ts'
import { LOCALE_PATHS, WEB_LOCALES } from './i18n/locale.ts'

export const SITE_URL = 'https://remoteharness.app'
export const REPO_URL = 'https://github.com/maarkN/remote-harness'
/** The author, credited at the bottom of every page. */
export const AUTHOR = { name: 'maarkn', url: 'https://maarkn.dev' } as const
/** GitHub logins shown in the footer's contributors line, in order. */
export const CONTRIBUTORS = ['maarkN', 'hannadev-uiux'] as const
/** What the site reads from its environment besides storage, kept out of the repository. */
export type SiteConfig = {
  /** The app install link page (`/app/<token>/`) the landing's iPhone & iPad card opens. */
  appInstallUrl?: string
}

/**
 * `APP_INSTALL_URL`: a path on this site (`/app/<token>/`) or an https URL. Anything else is
 * ignored, and the card falls back to the docs.
 */
export function siteConfig(env: Record<string, string | undefined>): SiteConfig {
  const raw = env.APP_INSTALL_URL?.trim()
  if (!raw) return {}
  if (/^\/[^/\\\s]/.test(raw) && URL.canParse(raw, SITE_URL)) return { appInstallUrl: raw }
  if (URL.canParse(raw) && new URL(raw).protocol === 'https:') return { appInstallUrl: new URL(raw).href }
  return {}
}

/** Brand image for link previews (`docs/brand/og.png`), bundled into the Worker and served here. */
export const OG_IMAGE_PATH = '/og.png'
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`

/**
 * The mark ("Cursor Signal": a terminal cursor block with the `>` prompt cut out of it and three
 * signal arcs leaving it to the right) in a 256 box, the same geometry as `apps/mobile/scripts/icons.mts`
 * and `docs/design/identity/shared.js`. The prompt is a black stroke in a luminance mask over the block.
 */
function markMarkup(cutout: number, arcs: number, maskId: string): string {
  return (
    `<mask id="${maskId}"><rect width="256" height="256" fill="#fff"/>` +
    `<path d="M47 99L81 128L47 157" fill="none" stroke="#000" stroke-width="${cutout}" stroke-linecap="round" stroke-linejoin="round"/></mask>` +
    `<rect x="26" y="60" width="76" height="136" rx="15" fill="currentColor" mask="url(#${maskId})"/>` +
    `<g fill="none" stroke="currentColor" stroke-width="${arcs}" stroke-linecap="round">` +
    '<path d="M129.6 104.9A36 36 0 0 1 129.6 151.1"/><path d="M160.2 79.1A76 76 0 0 1 160.2 176.9"/>' +
    '<path d="M190.9 53.4A116 116 0 0 1 190.9 202.6"/></g>'
  )
}

/** Regular weight: the landing and the install link page. */
export const MARK_REGULAR = markMarkup(18, 22, 'rh-cursor')

/** Bold weight (wider cutout and arcs), for anything under 24 px (the favicon). */
export const MARK_BOLD = markMarkup(26, 28, 'rh-cursor-bold')

/** Amber mark in a 78 % box on the flat warm dark, with the icon's 22 % corners. */
export function faviconSvg(): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" color="#e8a33d">' +
    '<rect width="256" height="256" rx="56" fill="#1c1a17"/>' +
    `<g transform="translate(16 16) scale(0.875)">${MARK_BOLD}</g></svg>`
  )
}

export function sitemapXml(): string {
  const docs = WEB_LOCALES.flatMap((locale) => DOC_SLUGS.map((slug) => docPath(locale, slug)))
  const paths = ['/', ...Object.values(LOCALE_PATHS), ...docs]
  const urls = paths.map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /ios/\nDisallow: /app/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
}
