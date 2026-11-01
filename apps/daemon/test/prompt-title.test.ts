import { describe, expect, test } from 'vitest'
import {
  isCommandPrompt,
  isMarkupTitle,
  promptTitle,
  promptTitleSource,
  renameTitle,
  replacesTitle,
} from '../src/features/sessions/prompt-title.ts'

const pasted = (content: string) => `<pasted_content id="p1">${content}</pasted_content>`

describe('promptTitle', () => {
  test('plain text, on one line', () => {
    expect(promptTitle('fix   the\nlogin bug')).toBe('fix the login bug')
  })

  test('the user words around a pasted block', () => {
    expect(promptTitle(`Summarize this\n${pasted('line one\nline two')}`)).toBe('Summarize this')
    expect(promptTitle(`What fails here? ${pasted('stack')} Thanks`)).toBe('What fails here? Thanks')
  })

  test('only a pasted block: its first non-empty line', () => {
    expect(promptTitle(pasted('\n\nError: connection refused\n  at main.ts:1'))).toBe(
      'Error: connection refused',
    )
    expect(promptTitle(`${pasted('')}\n${pasted('second paste')}`)).toBe('second paste')
  })

  test('a slash command: the command and its arguments', () => {
    const prompt = '<command-message>review</command-message>\n<command-name>/review</command-name>'
    expect(promptTitle(prompt)).toBe('/review')
    expect(promptTitle(`${prompt}\n<command-args>123</command-args>`)).toBe('/review 123')
  })

  test('system reminders and command output never count', () => {
    expect(promptTitle('<system-reminder>context</system-reminder>\nrun the tests')).toBe('run the tests')
    expect(promptTitle('<system-reminder>only context</system-reminder>')).toBeNull()
    expect(promptTitle('<local-command-stdout>done</local-command-stdout>')).toBeNull()
  })

  test('cut-off blocks never show their tag', () => {
    expect(promptTitle('<pasted_content id="p1">first line of a long paste')).toBe(
      'first line of a long paste',
    )
    expect(promptTitle('ask this <system-reminder>cut off')).toBe('ask this')
  })

  test('empty prompts give no title', () => {
    expect(promptTitle('')).toBeNull()
    expect(promptTitle('   \n ')).toBeNull()
    expect(promptTitle(pasted('  '))).toBeNull()
  })

  test('user text with ordinary angle brackets stays', () => {
    expect(promptTitle('fix the <Button> and a < b')).toBe('fix the <Button> and a < b')
  })

  test('long titles are clipped', () => {
    expect(promptTitle(pasted('x'.repeat(200)))).toHaveLength(80)
  })
})

describe('isCommandPrompt / isMarkupTitle', () => {
  test('slash commands and shell lines are commands', () => {
    expect(isCommandPrompt('<command-name>/clear</command-name>')).toBe(true)
    expect(isCommandPrompt('<bash-input>ls</bash-input>')).toBe(true)
    expect(isCommandPrompt(pasted('x'))).toBe(false)
  })

  test('a raw tag title is markup', () => {
    expect(isMarkupTitle('<pasted_content id=abc>…')).toBe(true)
    expect(isMarkupTitle('fix login')).toBe(false)
  })

  test('commands typed as is, without markup, are commands too (#474)', () => {
    expect(isCommandPrompt('/clear')).toBe(true)
    expect(isCommandPrompt('  /model opus')).toBe(true)
    expect(isCommandPrompt('!ls -la')).toBe(true)
    expect(isCommandPrompt('/')).toBe(false)
    expect(isCommandPrompt('fix /etc/hosts')).toBe(false)
    expect(promptTitleSource('/clear')).toBe('command')
    expect(promptTitleSource('why does it fail?')).toBe('prompt')
  })
})

describe('title precedence (#474)', () => {
  test('a title only gives way to a stronger source; the first of a kind stays', () => {
    expect(replacesTitle('folder', 'command')).toBe(true)
    expect(replacesTitle('folder', 'prompt')).toBe(true)
    expect(replacesTitle('command', 'prompt')).toBe(true)
    expect(replacesTitle('command', 'command')).toBe(false)
    expect(replacesTitle('prompt', 'prompt')).toBe(false)
    expect(replacesTitle('prompt', 'command')).toBe(false)
    expect(replacesTitle('prompt', 'custom')).toBe(true)
    expect(replacesTitle('custom', 'prompt')).toBe(false)
    expect(replacesTitle('custom', 'custom')).toBe(false)
  })

  test('/rename gives the name, typed as is or with the command markup', () => {
    expect(renameTitle('/rename Login bug')).toBe('Login bug')
    expect(renameTitle('<command-name>/rename</command-name>\n<command-args>Login  bug</command-args>')).toBe(
      'Login bug',
    )
    expect(renameTitle('/rename')).toBeNull()
    expect(renameTitle('/renamed it')).toBeNull()
    expect(renameTitle('please rename the file')).toBeNull()
  })
})
