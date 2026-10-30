import type { Question, TranscriptEntry } from '@remote-harness/protocol'
import { describe, expect, it } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import {
  cutAtSentence,
  lastAnswer,
  permissionSentence,
  questionSentence,
  READOUT_MAX,
  speakable,
  turnSentence,
} from './readout'

const { t } = createI18n('en-US')

describe('speakable', () => {
  it('reads code blocks as a note, links by their text, and drops markup', () => {
    const markdown = [
      '## Done',
      '',
      'I **fixed** the `login` flow, see [the PR](https://example.com/pr/1).',
      '',
      '```ts',
      'const a = 1',
      '```',
      '- tests pass',
      '- lint is _clean_',
      'More at https://example.com/x',
    ].join('\n')
    expect(speakable(markdown, '(code in the app)')).toBe(
      'Done. I fixed the login flow, see the PR. (code in the app). tests pass. lint is clean. More at.',
    )
  })

  it('reads table rows as lists', () => {
    expect(speakable('| a | b |\n|---|---|\n| 1 | 2 |', 'code')).toBe('a, b. 1, 2.')
  })
})

describe('cutAtSentence', () => {
  it('keeps short texts and cuts long ones after a full sentence', () => {
    expect(cutAtSentence('Short.', 50, 'More.')).toBe('Short.')
    const text = 'First sentence here. Second sentence here. Third one that does not fit.'
    expect(cutAtSentence(text, 50, 'More in the app.')).toBe(
      'First sentence here. Second sentence here. More in the app.',
    )
  })

  it('falls back to a word boundary without sentences', () => {
    expect(cutAtSentence('one two three four five six', 12, 'More.')).toBe(
      'one two…  More.'.replace('  ', ' '),
    )
  })
})

const entry = (kind: TranscriptEntry['kind'], text: string, isSidechain = false) =>
  ({
    kind,
    text,
    isSidechain,
    cursor: 1,
    index: 0,
    uuid: text,
    timestamp: null,
    key: text,
  }) as unknown as TranscriptEntry

describe('lastAnswer', () => {
  it('is the last assistant text after the last prompt, skipping subagents', () => {
    const entries = [
      entry('user', 'go'),
      entry('assistant_text', 'Working'),
      entry('assistant_text', 'Done'),
      entry('assistant_text', 'sub', true),
    ]
    const answer = lastAnswer(entries)
    expect(answer?.kind === 'assistant_text' ? answer.text : null).toBe('Done')
  })

  it('is null when the latest prompt has no answer yet', () => {
    expect(lastAnswer([entry('assistant_text', 'old'), entry('user', 'new')])).toBeNull()
  })
})

describe('sentences', () => {
  it('cuts long turns with a note', () => {
    const long = `${'This is a sentence. '.repeat(60)}`
    const spoken = turnSentence(long, t)
    expect(spoken.length).toBeLessThanOrEqual(READOUT_MAX + 60)
    expect(spoken.endsWith(t('handsFree.restInApp'))).toBe(true)
  })

  it('reads a permission with how to answer', () => {
    expect(permissionSentence({ tool: 'Bash', input: { command: 'pnpm test' } }, t)).toMatch(
      /\. Say allow or deny\.$/,
    )
  })

  it('numbers the options of a question', () => {
    const question: Question = {
      question: 'Which database?',
      header: null,
      kind: 'choice',
      options: [
        { label: 'Postgres', description: null },
        { label: 'SQLite', description: null },
      ],
      multiSelect: false,
    }
    expect(questionSentence(question, t)).toBe(
      'Which database? Option 1, Postgres. Option 2, SQLite. Say the option number.',
    )
    expect(questionSentence({ ...question, multiSelect: true }, t)).toMatch(
      /Say the option numbers, like one and three\.$/,
    )
  })
})
