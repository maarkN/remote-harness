import type { TranscriptEntry } from '@remote-harness/protocol'
import { expect, test } from 'vitest'
import { searchText } from './search-text'

const base = { key: 'k', cursor: 0, index: 0, uuid: 'u', timestamp: null, isSidechain: false }

test('the prose of each entry kind', () => {
  const entries: [TranscriptEntry, string][] = [
    [{ ...base, kind: 'user', text: 'Fix the pool', images: [] }, 'Fix the pool'],
    [{ ...base, kind: 'assistant_text', text: 'Done' }, 'Done'],
    [
      {
        ...base,
        kind: 'tool_use',
        toolUseId: 't',
        name: 'Bash',
        input: { command: 'npm test', description: 'Run the tests', timeout: 5 },
      },
      'Bash Run the tests npm test',
    ],
    [
      {
        ...base,
        kind: 'tool_result',
        toolUseId: 't',
        content: '3 passed',
        isError: false,
        truncated: false,
        images: [],
      },
      '3 passed',
    ],
    [{ ...base, kind: 'system', subtype: 'command', text: '/review' }, '/review'],
    [{ ...base, kind: 'unknown', raw: '{}' }, ''],
  ]
  for (const [entry, text] of entries) expect(searchText(entry)).toBe(text)
})
