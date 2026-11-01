import { describe, expect, test } from 'vitest'
import { STORE_LIMITS, STORE_METADATA, type StoreListing } from '../store/metadata'

const LOCALES = ['en-US', 'pt-BR', 'es-ES'] as const
const PLATFORMS = ['ios', 'android'] as const
const SITE_PATHS = { 'en-US': '/en/', 'pt-BR': '/pt-br/', 'es-ES': '/es/' } as const

/** Every text of a listing with its path: platform variants flattened, keywords joined as the store gets them. */
function texts(listing: StoreListing): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const [field, value] of Object.entries(listing)) {
    if (typeof value === 'string') out.push([field, value])
    else if (Array.isArray(value)) out.push([field, value.join(',')])
    else for (const [platform, text] of Object.entries(value)) out.push([`${field}.${platform}`, text])
  }
  return out
}

describe('store metadata', () => {
  test.each(LOCALES)('%s respects the stores’ limits and has no empty field', (locale) => {
    const listing = STORE_METADATA[locale]
    const lengths: Array<[keyof typeof STORE_LIMITS, string, number]> = [
      ['name', 'name', listing.name.length],
      ['subtitle', 'subtitle', listing.subtitle.length],
      ['shortDescription', 'shortDescription', listing.shortDescription.length],
      ['description', 'description.ios', listing.description.ios.length],
      ['description', 'description.android', listing.description.android.length],
      ['keywords', 'keywords', listing.keywords.join(',').length],
      ['promotionalText', 'promotionalText', listing.promotionalText.length],
      ['releaseNotes', 'releaseNotes.ios', listing.releaseNotes.ios.length],
      ['releaseNotes', 'releaseNotes.android', listing.releaseNotes.android.length],
    ]
    for (const [limit, field, length] of lengths) {
      expect(length, `${locale} ${field}`).toBeLessThanOrEqual(STORE_LIMITS[limit])
    }
    for (const [field, value] of texts(listing)) {
      expect(value.trim(), `${locale} ${field}`).not.toBe('')
    }
    expect(listing.keywords.length).toBeGreaterThan(0)
    for (const keyword of listing.keywords) {
      expect(keyword, `${locale} keyword`).toBe(keyword.trim())
      expect(keyword, `${locale} keyword`).not.toContain(',')
    }
  })

  test('the three languages have the same shape and their own site pages', () => {
    const shape = (listing: StoreListing) => texts(listing).map(([field]) => field)
    for (const locale of LOCALES) {
      expect(shape(STORE_METADATA[locale])).toEqual(shape(STORE_METADATA['en-US']))
      const base = `https://remoteharness.app${SITE_PATHS[locale]}`
      expect(STORE_METADATA[locale].marketingUrl).toBe(base)
      expect(STORE_METADATA[locale].supportUrl).toBe(`${base}docs/troubleshooting/`)
      expect(STORE_METADATA[locale].privacyUrl).toBe(`${base}docs/privacy/`)
    }
  })

  test('copy names the product, the install command and the trademarks, and nothing private', () => {
    for (const locale of LOCALES) {
      for (const platform of PLATFORMS) {
        const text = `${STORE_METADATA[locale].description[platform]} ${STORE_METADATA[locale].promotionalText}`
        expect(text).not.toMatch(/tailscale|tailnet/i)
        expect(text).toContain('curl -fsSL https://remoteharness.app/install | bash')
        expect(text).toContain('Anthropic, PBC')
        expect(text).not.toMatch(/doctorx|acme|bypass/i)
      }
    }
  })

  test.each(LOCALES)('%s names no other platform in either store (App Store guideline 2.3.10)', (locale) => {
    const listing = STORE_METADATA[locale]
    const appStore: Array<[string, string]> = [
      ['name', listing.name],
      ['subtitle', listing.subtitle],
      ['promotionalText', listing.promotionalText],
      ['keywords', listing.keywords.join(',')],
      ['description.ios', listing.description.ios],
      ['releaseNotes.ios', listing.releaseNotes.ios],
    ]
    for (const [field, text] of appStore) {
      expect(text, `${locale} ${field}`).not.toMatch(/android|google/i)
    }
    const googlePlay: Array<[string, string]> = [
      ['name', listing.name],
      ['shortDescription', listing.shortDescription],
      ['description.android', listing.description.android],
      ['releaseNotes.android', listing.releaseNotes.android],
    ]
    for (const [field, text] of googlePlay) {
      expect(text, `${locale} ${field}`).not.toMatch(
        /\biphone\b|\bipad\b|\bios\b|app store|\bsiri\b|dynamic island/i,
      )
    }
  })
})
