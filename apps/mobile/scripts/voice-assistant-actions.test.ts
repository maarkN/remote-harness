import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_LINK_ACTIVITY,
  CUSTOM_INTENTS,
  QUERY_FOLDERS,
  queryArraysXml,
  shortcutsXml,
} from '../modules/voice-assistant/android-actions.ts'

const xml = shortcutsXml('com.example.app')

describe('shortcuts.xml', () => {
  it('declares the message intent with its text and recipient', () => {
    expect(xml).toContain('<capability android:name="actions.intent.CREATE_MESSAGE">')
    expect(xml).toContain('remoteharness://assistant/reply{?text,session}')
    expect(xml).toContain('<parameter android:name="message.text" android:key="text" />')
    expect(xml).toContain('<parameter android:name="message.recipient.name" android:key="session" />')
  })

  it('declares every custom intent with its query patterns and link', () => {
    for (const [array, action] of Object.entries(CUSTOM_INTENTS)) {
      expect(xml).toContain(`<capability android:name="${action.name}" app:queryPatterns="@array/${array}">`)
      expect(xml).toContain(`<url-template android:value="${action.link}" />`)
    }
  })

  it('opens the forwarding activity of the app package', () => {
    const targets = [...xml.matchAll(/android:targetClass="([^"]+)"/g)].map((m) => m[1])
    expect(targets).toHaveLength(1 + Object.keys(CUSTOM_INTENTS).length)
    expect(new Set(targets)).toEqual(new Set([ASSISTANT_LINK_ACTIVITY]))
    expect(xml).toContain('android:targetPackage="com.example.app"')
  })

  it('opens and closes every element', () => {
    for (const tag of ['shortcuts', 'capability', 'intent']) {
      const opened = xml.match(new RegExp(`<${tag}[\\s>]`, 'g'))?.length ?? 0
      expect(xml.match(new RegExp(`</${tag}>`, 'g'))?.length ?? 0, tag).toBe(opened)
    }
  })
})

describe('query patterns', () => {
  it('has patterns for every intent in each language', () => {
    for (const language of Object.keys(QUERY_FOLDERS) as (keyof typeof QUERY_FOLDERS)[]) {
      const arrays = queryArraysXml(language)
      for (const [array, action] of Object.entries(CUSTOM_INTENTS)) {
        expect(arrays).toContain(`<string-array name="${array}">`)
        expect(action.patterns[language].length, `${array} ${language}`).toBeGreaterThan(0)
      }
    }
  })

  it('escapes apostrophes as Android string resources need', () => {
    expect(queryArraysXml('en')).toContain("<item>what\\'s waiting</item>")
  })

  it('writes English as the default resources', () => {
    expect(QUERY_FOLDERS.en).toBe('values')
  })
})
