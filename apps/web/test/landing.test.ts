import { describe, expect, test } from 'vitest'
import { esc, inline } from '../src/html.ts'
import { CATALOGS, WEB_LOCALES } from '../src/i18n/index.ts'
import { INSTALL_COMMANDS, renderLanding, renderNotFound } from '../src/landing.ts'
import { AUTHOR, CONTRIBUTORS, faviconSvg, robotsTxt, sitemapXml } from '../src/site.ts'

/** Dotted paths of every leaf, with array lengths, so the three catalogs can be compared. */
function shape(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return [
      `${prefix}[${value.length}]`,
      ...value.flatMap((item, index) => shape(item, `${prefix}[${index}]`)),
    ]
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => shape(item, prefix ? `${prefix}.${key}` : key))
  }
  return [`${prefix}:${typeof value}`]
}

function leaves(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(leaves)
  if (value && typeof value === 'object') return Object.values(value).flatMap(leaves)
  return typeof value === 'string' ? [value] : []
}

describe('html helpers', () => {
  test('escapes and renders the inline markup', () => {
    expect(esc('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
    expect(inline('Run `remote-harness pair` <now>')).toBe('Run <code>remote-harness pair</code> &lt;now&gt;')
    expect(inline('Read [SECURITY.md](https://example.com/S.md) or [home](/) or [app](#app)')).toBe(
      'Read <a href="https://example.com/S.md">SECURITY.md</a> or <a href="/">home</a> or <a href="#app">app</a>',
    )
    expect(inline('[x](javascript:alert(1))')).toBe('[x](javascript:alert(1))')
  })
})

describe('catalogs', () => {
  test('pt-BR and es-ES have the shape of en-US and no empty text', () => {
    const reference = shape(CATALOGS['en-US'])
    expect(shape(CATALOGS['pt-BR'])).toEqual(reference)
    expect(shape(CATALOGS['es-ES'])).toEqual(reference)
    for (const locale of WEB_LOCALES) {
      for (const text of leaves(CATALOGS[locale])) expect(text.trim(), locale).not.toBe('')
    }
  })
})

describe('renderLanding', () => {
  test.each(WEB_LOCALES)('%s: language, metadata, alternates, sections and commands', (locale) => {
    const html = renderLanding(locale)
    const m = CATALOGS[locale]
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain(`<html lang="${locale}">`)
    expect(html).toContain(`<title>${m.meta.title}</title>`)
    expect(html).toContain('<link rel="alternate" hreflang="pt-BR" href="https://remoteharness.app/pt-br/">')
    expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://remoteharness.app/">')
    expect(html).toContain('og:image" content="https://remoteharness.app/og.png"')
    for (const id of ['how', 'features', 'security', 'install', 'docs', 'app'])
      expect(html).toContain(`id="${id}"`)
    expect(html).toContain(`data-copy="${INSTALL_COMMANDS.unix}"`)
    expect(html).toContain(`data-copy="${INSTALL_COMMANDS.windows}"`)
    expect(html).toContain(`data-copied="${m.install.copied}"`)
    expect(html).toContain(m.hero.title)
    expect(html).toContain(m.faq.items[0]?.q ?? 'missing')
    expect(html).not.toMatch(/undefined|\[object Object\]|\{\{/)
    // Agents show their marks, not the two-letter codes; the footer credits the author and contributors.
    expect(html).not.toMatch(/>(cl|cx|ki|qw)</)
    for (const id of ['claude', 'codex', 'kimi', 'qwen', 'openrouter'])
      expect(html).toContain(`class="mk ${id}"`)
    expect(html).toContain(`<a href="${AUTHOR.url}">${AUTHOR.name}</a>`)
    for (const login of CONTRIBUTORS) expect(html).toContain(`href="https://github.com/${login}"`)
    expect(html).toContain(m.footer.contributors)
    // The only external resources are the fonts.
    const externals = [...html.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)].map((match) => match[1])
    // Links (not resources) to the contributors' profiles and the author's site are fine too.
    const credits = [AUTHOR.url, ...CONTRIBUTORS.map((login) => `https://github.com/${login}`)]
    const foreign = externals.filter(
      (url) =>
        !credits.includes(url ?? '') &&
        !/^https:\/\/(fonts\.g(oogleapis|static)\.com|github\.com\/maarkN|raw\.githubusercontent\.com\/maarkN|remoteharness\.app)/.test(
          url ?? '',
        ),
    )
    expect(foreign).toEqual([])
  })

  test.each(WEB_LOCALES)('%s: the hero carousel', (locale) => {
    const html = renderLanding(locale)
    const m = CATALOGS[locale]
    expect(m.hero.slides).toHaveLength(3)
    expect(html).toContain(
      `role="region" aria-roledescription="${esc(m.hero.carousel.role)}" aria-label="${esc(m.hero.carousel.label)}" data-carousel`,
    )
    // One labelled slide per screen, in order, inside a single frame that scrolls without the script.
    const labels = [...html.matchAll(/<div class="slide[^"]*" role="img" aria-label="([^"]+)">/g)].map(
      (x) => x[1],
    )
    expect(labels).toEqual(m.hero.slides.map((s) => esc(s.label)))
    expect(html.match(/class="phone"/g)).toHaveLength(1)
    expect(html).toContain('<div class="track" tabindex="0" data-track>')
    // The controls exist only for the script to reveal; the first dot is current.
    expect(html).toContain('<div class="cnav" hidden>')
    expect(html).toContain(
      `data-go="0" aria-label="${esc(m.hero.slides[0]?.name ?? '')}" aria-current="true"`,
    )
    expect(html.match(/data-go="\d"/g)).toHaveLength(3)
    expect(html).toContain(`aria-label="${esc(m.hero.carousel.previous)}"`)
    expect(html).toContain(`aria-label="${esc(m.hero.carousel.next)}"`)
    // The three screens' demo text comes from the catalog.
    const c = m.mock.conversation
    for (const text of [c.prompt, c.intro, c.placeholder, c.tools[2]?.result ?? '', m.mock.live.date])
      expect(html).toContain(esc(text))
    expect(html).toContain(inline(c.reply))
    expect(html).toContain(`<span class="st">${esc(m.mock.live.waiting.state)}</span>`)
    expect(html).toContain('class="la working"')
    expect(html).toContain('class="la waiting"')
  })

  test('the carousel script respects reduced motion and pauses on hover and focus', () => {
    const html = renderLanding('en-US')
    expect(html).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(html).toContain('nav.hidden=false')
    for (const event of ['mouseenter', 'mouseleave', 'focusin', 'focusout'])
      expect(html).toContain(`addEventListener('${event}'`)
    expect(html).toContain('scroll-snap-type: x mandatory')
  })

  test('the root page keeps its own canonical; the language switcher marks the current one', () => {
    const root = renderLanding('es-ES', '/')
    expect(root).toContain('<link rel="canonical" href="https://remoteharness.app/">')
    expect(root).toContain(
      '<a href="/es/" hreflang="es-ES" lang="es-ES" title="Español" aria-current="page">ES</a>',
    )
    expect(renderLanding('en-US')).toContain('<link rel="canonical" href="https://remoteharness.app/en/">')
  })

  test('404 page', () => {
    const html = renderNotFound('pt-BR')
    expect(html).toContain('<html lang="pt-BR">')
    expect(html).toContain(CATALOGS['pt-BR'].notFound.title)
    expect(html).toContain('<meta name="robots" content="noindex">')
    expect(html).toContain('href="/pt-br/"')
  })
})

describe('site files', () => {
  test('sitemap, robots and favicon', () => {
    const sitemap = sitemapXml()
    for (const path of ['/', '/en/', '/pt-br/', '/es/'])
      expect(sitemap).toContain(`<loc>https://remoteharness.app${path}</loc>`)
    expect(robotsTxt()).toContain('Sitemap: https://remoteharness.app/sitemap.xml')
    expect(robotsTxt()).toContain('Disallow: /ios/')
    expect(faviconSvg().startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  })
})
