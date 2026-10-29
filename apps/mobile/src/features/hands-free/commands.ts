import type { Locale } from '@remote-harness/protocol'
import { VOCABULARY, type Vocabulary } from './vocabulary'

/** What one heard utterance means. Anything that is not a command is a message to send. */
export type Command =
  | { kind: 'allow' | 'deny' | 'yes' | 'no' | 'repeat' | 'stop' }
  | { kind: 'options'; numbers: number[] }
  | { kind: 'message'; text: string }
  | { kind: 'empty' }

/** Lowercase, without accents, apostrophes or punctuation, single spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const WORD_COMMANDS = ['stop', 'allow', 'deny', 'yes', 'no', 'repeat'] as const

function numberOf(token: string, vocabulary: Vocabulary): number | null {
  if (/^\d{1,2}$/.test(token)) {
    const value = Number(token)
    return value > 0 ? value : null
  }
  const index = [...vocabulary.numbers, ...vocabulary.ordinals].findIndex((words) => words.includes(token))
  return index === -1 ? null : (index % vocabulary.numbers.length) + 1
}

/** Option numbers when the whole utterance is made of them ("option 2", "1 and 3", "second"). */
function optionsOf(words: string[], vocabulary: Vocabulary): number[] | null {
  const rest = words.filter((word) => !vocabulary.option.includes(word) && !vocabulary.and.includes(word))
  if (rest.length === 0) return null
  const numbers: number[] = []
  for (const word of rest) {
    const value = numberOf(word, vocabulary)
    if (value === null) return null
    if (!numbers.includes(value)) numbers.push(value)
  }
  return numbers
}

/** Understands an utterance in the transcription language; a command must be the whole utterance. */
export function parseCommand(text: string, language: Locale): Command {
  const vocabulary = VOCABULARY[language]
  const heard = normalize(text)
  if (!heard) return { kind: 'empty' }
  for (const kind of WORD_COMMANDS) {
    if (vocabulary[kind].includes(heard)) return { kind }
  }
  const numbers = optionsOf(heard.split(' '), vocabulary)
  if (numbers) return { kind: 'options', numbers }
  return { kind: 'message', text: text.trim() }
}
