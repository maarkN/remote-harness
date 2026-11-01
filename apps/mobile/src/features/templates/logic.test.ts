import { describe, expect, test } from 'vitest'
import {
  builtinValues,
  cleanTitle,
  fillTemplate,
  missingPlaceholders,
  newTemplateId,
  type PromptTemplate,
  parseTemplate,
  parseTemplateIndex,
  placeholdersOf,
  serializeTemplate,
  sortTemplates,
  templatePreview,
  templateStorageKey,
  upsertTemplate,
} from './logic'

describe('placeholders', () => {
  test('lists {name} tokens once, in order, and ignores JSON-like braces', () => {
    const text = 'Review {branch} for {ticket}; {branch} again; {"key": 1} {1st} { spaced } {a-b_c}'
    expect(placeholdersOf(text)).toEqual(['branch', 'ticket', 'a-b_c'])
    expect(placeholdersOf('plain')).toEqual([])
  })

  test('built-in values: branch, folder and cwd when known, the local date always', () => {
    const now = new Date(2026, 10, 1, 9, 30)
    expect(builtinValues({ branch: 'fix/login', cwd: '/Users/u/work/api/', now })).toEqual({
      branch: 'fix/login',
      cwd: '/Users/u/work/api',
      folder: 'api',
      date: '2026-11-01',
    })
    expect(builtinValues({ branch: null, cwd: null, now })).toEqual({ date: '2026-11-01' })
  })

  test('fills the placeholders with a value and keeps the blank or unknown ones as typed', () => {
    const filled = fillTemplate('Notes for {version} on {branch} ({date})', {
      branch: 'main',
      version: ' ',
      date: '2026-11-01',
    })
    expect(filled).toBe('Notes for {version} on main (2026-11-01)')
  })

  test('what the form asks: the placeholders without a usable value', () => {
    expect(missingPlaceholders('{branch} {version} {since}', { branch: 'main', version: '' })).toEqual([
      'version',
      'since',
    ])
    expect(missingPlaceholders('plain text', {})).toEqual([])
  })
})

describe('templates', () => {
  const template = (id: string, title: string, text = 'x'): PromptTemplate => ({
    id,
    title,
    text,
    updatedAt: 1,
  })

  test('title: one line, collapsed, at most 60 characters; preview: one line with an ellipsis', () => {
    expect(cleanTitle('  Review\n the   PR ')).toBe('Review the PR')
    expect(cleanTitle('x'.repeat(70))).toHaveLength(60)
    expect(cleanTitle(' \n ')).toBe('')
    expect(templatePreview('Review the PR.\n\nList the risks.')).toBe('Review the PR. List the risks.')
    expect(templatePreview('y'.repeat(100))).toBe(`${'y'.repeat(80)}…`)
  })

  test('sorted by title regardless of case; upsert replaces by id', () => {
    const list = sortTemplates([
      template('b', 'release notes'),
      template('a', 'Review PR'),
      template('c', 'fix tests'),
    ])
    expect(list.map((t) => t.id)).toEqual(['c', 'b', 'a'])
    const next = upsertTemplate(list, template('b', 'Zebra'))
    expect(next.map((t) => t.id)).toEqual(['c', 'a', 'b'])
    expect(upsertTemplate(list, template('d', 'Abc'))).toHaveLength(4)
  })

  test('serializes and parses a template, dropping unreadable items; the index keeps string ids', () => {
    const saved = template('k1', 'T', 'Review {branch}')
    expect(parseTemplate(serializeTemplate(saved))).toEqual(saved)
    expect(parseTemplate(JSON.stringify({ id: 'k', title: ' ', text: 'x' }))).toBeNull()
    expect(parseTemplate(JSON.stringify({ id: 'k', title: 'T', text: 'x' }))).toEqual({
      id: 'k',
      title: 'T',
      text: 'x',
      updatedAt: 0,
    })
    expect(parseTemplate('{nope')).toBeNull()
    expect(parseTemplate(null)).toBeNull()
    expect(parseTemplateIndex('["a", 1, "b", ""]')).toEqual(['a', 'b'])
    expect(parseTemplateIndex('oops')).toEqual([])
  })

  test('ids and keys use the characters SecureStore accepts', () => {
    const id = newTemplateId(1_762_000_000_000, 0.123456789)
    expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
    expect(templateStorageKey(id)).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(newTemplateId(1, 0)).toBe('1-0')
  })
})
