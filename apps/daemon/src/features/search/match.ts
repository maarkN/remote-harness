import { TRANSCRIPT_SEARCH_SNIPPET_CHARS } from '@remote-harness/protocol'

/** `[start, end)` offsets of a matched word, in UTF-16 code units of the text it was found in. */
export type MatchRange = { start: number; end: number }

/** A word: a run of letters and digits, like the `unicode61` tokenizer of the app's FTS5 index. */
const WORD = /[\p{L}\p{N}]+/gu

/** Lower case without diacritics (`Café` → `cafe`), the way the app's index folds its tokens. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
}

/** The distinct folded words of a query, in order; empty when the query has no word. */
export function queryTerms(query: string): string[] {
  const terms: string[] = []
  for (const match of query.matchAll(WORD)) {
    const term = fold(match[0])
    if (!terms.includes(term)) terms.push(term)
  }
  return terms
}

/**
 * Where the words of `text` equal to one of `terms` are, in order. Empty unless every term occurs:
 * all the words of a query must match, as in the app's FTS query.
 */
export function matchRanges(text: string, terms: readonly string[]): MatchRange[] {
  if (terms.length === 0) return []
  // Cheap check before walking the words: every term has to occur somewhere in the folded text.
  const folded = fold(text)
  if (!terms.every((term) => folded.includes(term))) return []
  const ranges: MatchRange[] = []
  const found = new Set<string>()
  for (const match of text.matchAll(WORD)) {
    const term = fold(match[0])
    if (!terms.includes(term)) continue
    found.add(term)
    ranges.push({ start: match.index, end: match.index + match[0].length })
  }
  return found.size === terms.length ? ranges : []
}

export type Snippet = {
  snippet: string
  /** The ranges that fall inside the snippet, relative to it. */
  ranges: MatchRange[]
  /** The snippet starts / ends inside the text. */
  cutStart: boolean
  cutEnd: boolean
}

const WHITESPACE = /\s/

/**
 * At most `max` characters of `text` around the first range: the match sits about a third into the
 * window, and both edges move to whitespace when a word would otherwise be cut.
 */
export function snippetAround(
  text: string,
  ranges: readonly MatchRange[],
  max = TRANSCRIPT_SEARCH_SNIPPET_CHARS,
): Snippet {
  const first = ranges[0]
  if (!first || text.length <= max) {
    const end = Math.min(text.length, max)
    return {
      snippet: text.slice(0, end),
      ranges: clip(ranges, 0, end),
      cutStart: false,
      cutEnd: end < text.length,
    }
  }
  let start = Math.max(0, first.start - Math.floor(max / 3))
  if (start > 0) {
    for (let i = start; i < first.start; i++) {
      if (WHITESPACE.test(text[i] ?? '')) {
        start = i + 1
        break
      }
    }
  }
  let end = Math.min(text.length, start + max)
  if (end < text.length) {
    for (let i = end; i > first.end; i--) {
      if (WHITESPACE.test(text[i] ?? '')) {
        end = i
        break
      }
    }
  }
  return {
    snippet: text.slice(start, end),
    ranges: clip(ranges, start, end),
    cutStart: start > 0,
    cutEnd: end < text.length,
  }
}

function clip(ranges: readonly MatchRange[], start: number, end: number): MatchRange[] {
  return ranges
    .filter((range) => range.start >= start && range.end <= end)
    .map((range) => ({ start: range.start - start, end: range.end - start }))
}
