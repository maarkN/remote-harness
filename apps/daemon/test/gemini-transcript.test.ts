import { appendFile, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  extractGeminiMeta,
  findGeminiImage,
  geminiTool,
  geminiTranscript,
  isGeminiSessionFile,
  parseGeminiLine,
} from '../src/features/transcript/gemini-format.ts'
import { readTailEntries, TranscriptFile } from '../src/features/transcript/transcript-file.ts'

const fixture = join(import.meta.dirname, 'fixtures', 'gemini-session.jsonl')

async function copyFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gemini-'))
  const path = join(dir, 'session.jsonl')
  await writeFile(path, await readFile(fixture, 'utf8'))
  return path
}

describe('gemini session file parser', () => {
  test('a message appended again shows each entry once', async () => {
    const file = new TranscriptFile(await copyFixture(), geminiTranscript)
    const lines = await file.sync()
    const all = lines.flatMap((line) => file.entries(line))
    expect(all.map((e) => [e.kind, e.cursor])).toEqual([
      ['user', 1],
      ['thinking', 3],
      ['assistant_text', 3],
      ['tool_use', 5],
      ['tool_result', 5],
      ['tool_use', 7],
      ['tool_result', 7],
      ['assistant_text', 8],
      ['system', 9],
      ['system', 10],
    ])
    expect(new Set(all.map((e) => e.key)).size).toBe(all.length)
  })

  test('page and since agree with the live read', async () => {
    const file = new TranscriptFile(await copyFixture(), geminiTranscript)
    await file.sync()
    const page = await file.page(file.lineCount, 50)
    const since = await file.since(0)
    expect(page.entries.filter((e) => e.kind === 'assistant_text')).toHaveLength(2)
    expect(since.entries.filter((e) => e.kind === 'tool_use')).toHaveLength(2)
  })

  test('a later append adds only the new tool call', async () => {
    const path = await copyFixture()
    const file = new TranscriptFile(path, geminiTranscript)
    await file.sync()
    const g3 = {
      id: 'g3',
      type: 'gemini',
      content: 'All tests pass.',
      toolCalls: [
        { id: 'glob-1', name: 'glob', args: { pattern: '**/*.ts' }, status: 'success', result: [] },
      ],
    }
    await appendFile(path, `${JSON.stringify(g3)}\n`)
    const fresh = await file.sync()
    expect(fresh.flatMap((line) => file.entries(line)).map((e) => e.kind)).toEqual([
      'tool_use',
      'tool_result',
    ])
  })

  test('the tail keeps the first copy of each entry', async () => {
    const { entries } = await readTailEntries(fixture, geminiTranscript)
    expect(entries.filter((e) => e.kind === 'assistant_text').map((e) => e.key)).toEqual([
      'g1:text',
      'g3:text',
    ])
  })

  test('shell call and its output', () => {
    const lines = (raw: string) => raw.split('\n').filter(Boolean)
    return readFile(fixture, 'utf8').then((text) => {
      const line = lines(text)[5] ?? ''
      const [use, result] = parseGeminiLine(line, 5).filter((e) => e.kind.startsWith('tool'))
      expect(use).toMatchObject({
        kind: 'tool_use',
        name: 'exec',
        input: { command: 'pnpm test' },
        toolUseId: 'run_shell_command-1761901930000-1',
      })
      expect(result).toMatchObject({ kind: 'tool_result', content: 'ok', isError: false })
    })
  })

  test('failed edit is an Edit with an error result', () => {
    const raw = JSON.stringify({
      id: 'g2',
      type: 'gemini',
      content: '',
      toolCalls: [
        {
          id: 'r1',
          name: 'replace',
          args: { file_path: '/w/a.ts', old_string: 'a', new_string: 'b' },
          status: 'error',
          result: [{ functionResponse: { response: { error: 'old_string not found' } } }],
        },
      ],
    })
    const [use, result] = parseGeminiLine(raw, 0)
    expect(use).toMatchObject({
      name: 'Edit',
      input: { file_path: '/w/a.ts', old_string: 'a', new_string: 'b' },
    })
    expect(result).toMatchObject({ content: 'old_string not found', isError: true })
  })

  test('cancelled requests and errors are system entries', () => {
    expect(parseGeminiLine('{"id":"i","type":"info","content":"Request cancelled."}', 0)).toMatchObject([
      { kind: 'system', subtype: 'turn_aborted', text: 'Interrupted' },
    ])
    expect(parseGeminiLine('{"id":"e","type":"error","content":"Quota exceeded."}', 0)).toMatchObject([
      { kind: 'system', subtype: 'error', text: 'Quota exceeded.' },
    ])
  })

  test('header, metadata records and garbage yield nothing', () => {
    for (const raw of ['{"sessionId":"s"}', '{"$set":{"a":1}}', '{"$rewindTo":"g1"}', 'not json', '[]'])
      expect(parseGeminiLine(raw, 0)).toEqual([])
  })

  test('prompt images', () => {
    const raw = JSON.stringify({
      id: 'u',
      type: 'user',
      content: [{ text: 'look' }, { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }],
    })
    expect(parseGeminiLine(raw, 4)).toMatchObject([
      { kind: 'user', text: 'look', images: [{ id: '4.0', mediaType: 'image/png', bytes: 5 }] },
    ])
    expect(findGeminiImage(raw, 0)).toMatchObject({ mediaType: 'image/png', data: 'aGVsbG8=' })
    expect(findGeminiImage(raw, 1)).toBeNull()
  })

  test('typed text wins over the expanded prompt', () => {
    const raw = JSON.stringify({
      id: 'u',
      type: 'user',
      content: [{ text: 'explain @a.ts\n--- a.ts ---\nconst a = 1' }],
      displayContent: [{ text: 'explain @a.ts' }],
    })
    expect(parseGeminiLine(raw, 0)).toMatchObject([{ kind: 'user', text: 'explain @a.ts' }])
  })
})

describe('gemini tool names', () => {
  test('known tools get the names the app renders', () => {
    expect(geminiTool('read_file', { file_path: '/a.ts' })).toEqual({
      name: 'Read',
      input: { file_path: '/a.ts' },
    })
    expect(geminiTool('write_file', { file_path: '/a.ts', content: 'x' })).toEqual({
      name: 'Write',
      input: { file_path: '/a.ts', content: 'x' },
    })
    expect(geminiTool('grep_search', { pattern: 'foo', dir_path: 'src' })).toEqual({
      name: 'Grep',
      input: { pattern: 'foo', path: 'src' },
    })
    expect(geminiTool('google_web_search', { query: 'tmux' })).toEqual({
      name: 'WebSearch',
      input: { query: 'tmux' },
    })
    expect(geminiTool('run_shell_command', { command: 'ls', dir_path: 'src' })).toEqual({
      name: 'exec',
      input: { command: 'ls', workdir: 'src' },
    })
  })

  test('other tools keep their name and arguments', () => {
    expect(geminiTool('web_fetch', { prompt: 'x' })).toEqual({ name: 'web_fetch', input: { prompt: 'x' } })
  })
})

describe('gemini session meta', () => {
  test('id from the header and the first prompt', async () => {
    const lines = (await readFile(fixture, 'utf8')).split('\n').filter(Boolean)
    expect(extractGeminiMeta(lines)).toEqual({
      id: '3f2a9c1e-5b7d-4e2f-9a10-6c8d2e4f1a3b',
      firstPrompt: 'run the tests',
    })
  })

  test('session file names', () => {
    expect(isGeminiSessionFile('session-2026-10-31T09-12-3f2a9c1e.jsonl')).toBe(true)
    expect(isGeminiSessionFile('session-2026-10-31T09-12-2-3f2a9c1e.jsonl')).toBe(true)
    expect(isGeminiSessionFile('session-2026-10-31T09-12-3f2a9c1e.json')).toBe(false)
    expect(isGeminiSessionFile('3f2a9c1e.jsonl')).toBe(false)
  })
})
