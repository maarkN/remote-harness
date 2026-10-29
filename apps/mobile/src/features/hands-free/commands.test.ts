import { LOCALES } from '@remote-harness/protocol'
import { describe, expect, it } from 'vitest'
import { normalize, parseCommand } from './commands'
import { VOCABULARY } from './vocabulary'

describe('parseCommand', () => {
  it('understands the word commands, ignoring case, accents and punctuation', () => {
    expect(parseCommand('Deny.', 'en-US')).toEqual({ kind: 'deny' })
    expect(parseCommand('  Allow it! ', 'en-US')).toEqual({ kind: 'allow' })
    expect(parseCommand('Sim', 'pt-BR')).toEqual({ kind: 'yes' })
    expect(parseCommand('Não', 'pt-BR')).toEqual({ kind: 'no' })
    expect(parseCommand('Sí', 'es-ES')).toEqual({ kind: 'yes' })
    expect(parseCommand("Don't send", 'en-US')).toEqual({ kind: 'no' })
    expect(parseCommand('de novo', 'pt-BR')).toEqual({ kind: 'repeat' })
    expect(parseCommand('Salir', 'es-ES')).toEqual({ kind: 'stop' })
  })

  it('reads option numbers as digits, words and ordinals', () => {
    expect(parseCommand('option 2', 'en-US')).toEqual({ kind: 'options', numbers: [2] })
    expect(parseCommand('Option two', 'en-US')).toEqual({ kind: 'options', numbers: [2] })
    expect(parseCommand('the second', 'en-US')).toEqual({ kind: 'message', text: 'the second' })
    expect(parseCommand('second', 'en-US')).toEqual({ kind: 'options', numbers: [2] })
    expect(parseCommand('opção três', 'pt-BR')).toEqual({ kind: 'options', numbers: [3] })
    expect(parseCommand('primeira', 'pt-BR')).toEqual({ kind: 'options', numbers: [1] })
    expect(parseCommand('opción uno y tres', 'es-ES')).toEqual({ kind: 'options', numbers: [1, 3] })
    expect(parseCommand('1 and 3 and 1', 'en-US')).toEqual({ kind: 'options', numbers: [1, 3] })
  })

  it('treats anything else as a message, kept as heard', () => {
    expect(parseCommand('Run the tests again', 'en-US')).toEqual({
      kind: 'message',
      text: 'Run the tests again',
    })
    expect(parseCommand('yes please fix it', 'en-US')).toEqual({ kind: 'message', text: 'yes please fix it' })
    expect(parseCommand('option zero', 'en-US')).toEqual({ kind: 'message', text: 'option zero' })
  })

  it('reports silence', () => {
    expect(parseCommand(' … ', 'en-US')).toEqual({ kind: 'empty' })
  })
})

describe('VOCABULARY', () => {
  it('has every word group, normalized, with ten numbers and ordinals per language', () => {
    const groups = Object.keys(VOCABULARY['en-US']).sort()
    for (const locale of LOCALES) {
      const vocabulary = VOCABULARY[locale]
      expect(Object.keys(vocabulary).sort()).toEqual(groups)
      expect(vocabulary.numbers).toHaveLength(10)
      expect(vocabulary.ordinals).toHaveLength(10)
      const words = Object.values(vocabulary).flat(2)
      for (const word of words) expect(normalize(word), `${locale}: ${word}`).toBe(word)
    }
  })

  it('does not give one utterance two meanings', () => {
    for (const locale of LOCALES) {
      const vocabulary = VOCABULARY[locale]
      const seen = new Map<string, string>()
      for (const kind of ['allow', 'deny', 'yes', 'no', 'repeat', 'stop'] as const) {
        for (const word of vocabulary[kind]) {
          expect(seen.get(word), `${locale}: "${word}" is ${seen.get(word)} and ${kind}`).toBeUndefined()
          seen.set(word, kind)
        }
      }
    }
  })
})
