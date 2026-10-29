import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  INTENT_STRINGS,
  SHORTCUT_PHRASES,
  stringCatalog,
  stringsFile,
} from '../modules/voice-assistant/app-intents/strings.ts'

const dir = join(__dirname, '..', 'modules', 'voice-assistant', 'app-intents')
const swift = readdirSync(dir)
  .filter((file) => file.endsWith('.swift'))
  .map((file) => readFileSync(join(dir, file), 'utf8'))
  .join('\n')
  // Comments mention texts that are not shown.
  .replace(/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** Literals that are payload fields or values sent to JavaScript, not texts shown to the user. */
const NOT_TEXT = new Set([
  'action',
  'reply',
  'text',
  'sessionId',
  'pending',
  'decision',
  'answer',
  'requestId',
  'waiting',
  'id',
  'payload',
  'foreground',
  'ok',
  'message',
  'RemoteHarnessAssistantRequest',
  'RemoteHarnessAssistantAck',
  'RemoteHarnessAssistantResponse',
  'RemoteHarnessAssistantSessions',
  '{title}',
])

/** Swift interpolations as `strings.ts` placeholders: `\(\.$x)` and `\(.applicationName)` → `{x}`. */
function catalogKey(literal: string): string {
  return literal.replace(/\\\(\\?\.\$?(\w+)\)/g, '{$1}').replace(/\\\((\w+)\)/g, '{$1}')
}

const literals = [...swift.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
  .map((match) => catalogKey(match[1] ?? ''))
  .filter((literal) => literal && !NOT_TEXT.has(literal))

describe('voice assistant strings', () => {
  it('translates every text the intents show, in en, pt-BR and es', () => {
    // `String(localized: key, defaultValue:)`: the default must be the catalog's English text.
    const defaults = new Set(Object.values(INTENT_STRINGS).map((texts) => texts.en))
    const missing = literals.filter(
      (literal) => !(literal in INTENT_STRINGS) && !(literal in SHORTCUT_PHRASES) && !defaults.has(literal),
    )
    expect(missing).toEqual([])
  })

  it('has no stale entries', () => {
    const used = new Set(literals)
    const stale = [...Object.keys(INTENT_STRINGS), ...Object.keys(SHORTCUT_PHRASES)].filter(
      (key) => !used.has(key),
    )
    expect(stale).toEqual([])
  })

  it('names the app in every phrase, in every language', () => {
    for (const [phrase, texts] of Object.entries(SHORTCUT_PHRASES)) {
      for (const value of [phrase, texts['pt-BR'], texts.es]) expect(value).toContain('{applicationName}')
    }
  })

  it('keeps the placeholders of each text in its translations', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort()
    for (const [key, texts] of Object.entries({ ...INTENT_STRINGS, ...SHORTCUT_PHRASES })) {
      const expected = placeholders(texts.en ?? key)
      expect(placeholders(texts['pt-BR']), key).toEqual(expected)
      expect(placeholders(texts.es), key).toEqual(expected)
    }
  })

  it('writes placeholders the way String Catalogs expect them', () => {
    const catalog = JSON.parse(
      stringCatalog({
        'Reply in {applicationName}': {
          'pt-BR': 'Responder no {applicationName}',
          es: 'Responder en {applicationName}',
        },
      }),
    )
    const key = Object.keys(catalog.strings)[0] ?? ''
    expect(key).toBe(['Reply in ', '$', '{applicationName}'].join(''))
    expect(catalog.strings[key].localizations['pt-BR'].stringUnit.value).toBe(
      ['Responder no ', '$', '{applicationName}'].join(''),
    )
  })

  it('writes the phrases as .strings per language, with escaped quotes and App Intents placeholders', () => {
    const texts = {
      'Say "hi" in {applicationName}': {
        'pt-BR': 'Diga "oi" no {applicationName}',
        es: 'Di "hola" en {applicationName}',
      },
    }
    const app = ['$', '{applicationName}'].join('')
    expect(stringsFile(texts, 'pt-BR')).toBe(`"Say \\"hi\\" in ${app}" = "Diga \\"oi\\" no ${app}";\n`)
    expect(stringsFile(texts, 'en')).toBe(`"Say \\"hi\\" in ${app}" = "Say \\"hi\\" in ${app}";\n`)
  })

  it('builds a String Catalog with the three languages', () => {
    const catalog = JSON.parse(stringCatalog({ Session: { 'pt-BR': 'Sessão', es: 'Sesión' } }))
    expect(catalog.sourceLanguage).toBe('en')
    expect(catalog.strings.Session.localizations).toEqual({
      en: { stringUnit: { state: 'translated', value: 'Session' } },
      es: { stringUnit: { state: 'translated', value: 'Sesión' } },
      'pt-BR': { stringUnit: { state: 'translated', value: 'Sessão' } },
    })
  })
})
