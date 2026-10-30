import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  approvalPolicyName,
  CONTEXT_BASELINE_TOKENS,
  codexLineStatus,
  codexTranscript,
  extractCodexMeta,
  findCodexImage,
  parseCodexLine,
  parseCodexMeta,
  patchFiles,
  rolloutSessionId,
  threadName,
  toolOutput,
} from '../src/features/transcript/codex-format.ts'
import { TranscriptFile } from '../src/features/transcript/transcript-file.ts'

const fixtures = join(import.meta.dirname, 'fixtures')
const paginated = join(fixtures, 'codex-paginated.jsonl')
const legacy = join(fixtures, 'codex-legacy.jsonl')

async function lines(path: string): Promise<string[]> {
  return (await readFile(path, 'utf8')).split('\n').filter(Boolean)
}

async function entries(path: string) {
  return (await lines(path)).flatMap((line, i) => parseCodexLine(line, i))
}

describe('codex rollout parser', () => {
  test('paginated rollout: each message once, tool calls from response items', async () => {
    const all = await entries(paginated)
    expect(all.map((e) => e.kind)).toEqual([
      'user',
      'thinking',
      'tool_use',
      'tool_result',
      'tool_use',
      'tool_result',
      'tool_use',
      'tool_result',
      'assistant_text',
      'system',
      'system',
      'system',
    ])
    expect(all[0]).toMatchObject({
      kind: 'user',
      text: 'run the tests',
      images: [{ id: '5.0', mediaType: 'image/png' }],
      cursor: 5,
      uuid: 'line-5',
      key: 'line-5:0',
      isSidechain: false,
      timestamp: '2026-10-19T17:37:09.021Z',
    })
    expect(all[1]).toMatchObject({ kind: 'thinking', text: '**Running tests**' })
    expect(all[2]).toMatchObject({
      kind: 'tool_use',
      toolUseId: 'call_abc',
      name: 'exec',
      input: { command: 'pnpm test', workdir: '/Users/me/proj' },
    })
    expect(all[3]).toMatchObject({
      kind: 'tool_result',
      toolUseId: 'call_abc',
      content: 'ok',
      isError: false,
    })
    expect(all[4]).toMatchObject({
      kind: 'tool_use',
      name: 'apply_patch',
      input: { files: ['src/app.css'] },
    })
    expect(all[5]).toMatchObject({ kind: 'tool_result', toolUseId: 'call_patch', isError: false })
    expect(all[7]).toMatchObject({ kind: 'tool_result', content: 'error: boom', isError: true })
    expect(all[8]).toMatchObject({ kind: 'assistant_text', text: 'All tests pass.' })
    expect(all[9]).toMatchObject({
      subtype: 'turn_duration',
      durationMs: 16050,
      text: 'Turn completed in 16s',
    })
    expect(all[10]).toMatchObject({ subtype: 'turn_aborted', text: 'Interrupted' })
    // `compacted` is skipped in paginated rollouts: the ContextCompaction item says it once.
    expect(all[11]).toMatchObject({ subtype: 'compact_boundary', cursor: 22 })
  })

  test('injected context never becomes a prompt', async () => {
    const all = await entries(paginated)
    expect(all.some((e) => e.kind === 'user' && e.text.includes('environment_context'))).toBe(false)
  })

  test('legacy rollout: events for messages, response items for tools', async () => {
    const all = await entries(legacy)
    expect(all.map((e) => e.kind)).toEqual([
      'user',
      'thinking',
      'tool_use',
      'tool_result',
      'assistant_text',
      'tool_use',
      'tool_result',
      'system',
    ])
    expect(all[0]).toMatchObject({ text: 'list files', images: [{ id: '4.0', mediaType: 'image/jpeg' }] })
    expect(all[2]).toMatchObject({ name: 'exec', input: { command: 'ls', workdir: '/Users/me/old' } })
    expect(all[3]).toMatchObject({ content: 'a.txt\nb.txt\n', isError: false })
    expect(all[5]).toMatchObject({ name: 'web_search', input: { query: 'codex cli' } })
    expect(all[7]).toMatchObject({ subtype: 'compact_boundary' })
  })

  test('other function calls keep their name and arguments', () => {
    const line = JSON.stringify({
      timestamp: 't',
      ordinal: 1,
      type: 'response_item',
      payload: { type: 'function_call', name: 'update_plan', arguments: '{"plan":[]}', call_id: 'c' },
    })
    expect(parseCodexLine(line, 0)).toMatchObject([{ name: 'update_plan', input: { plan: [] } }])
    const bad = JSON.stringify({
      type: 'response_item',
      payload: { type: 'function_call', name: 'x', arguments: 'not json', call_id: 'c' },
    })
    expect(parseCodexLine(bad, 0)).toMatchObject([{ input: { arguments: 'not json' } }])
  })

  test('never throws on odd lines', () => {
    for (const raw of ['', 'nope', '[]', '{"type":"event_msg"}', '{"type":"response_item","payload":1}']) {
      expect(parseCodexLine(raw, 0)).toEqual([])
    }
  })

  test('images are found by the ids the parser gave them', async () => {
    const all = await lines(paginated)
    expect(findCodexImage(all[5]!, 0)).toMatchObject({ mediaType: 'image/png', data: 'iVBORw0KGgo=' })
    expect(findCodexImage(all[5]!, 1)).toBeNull()
    expect(findCodexImage(all[4]!, 0)).toBeNull()
    expect(findCodexImage('nope', 0)).toBeNull()
  })

  test('TranscriptFile pages with the Codex format', async () => {
    const file = new TranscriptFile(paginated, codexTranscript)
    await file.sync()
    const page = await file.page(file.lineCount, 3)
    expect(page.entries.map((e) => e.kind)).toEqual(['system', 'system', 'system'])
    expect(page.hasMore).toBe(true)
  })
})

describe('codex helpers', () => {
  test('meta lines carry the approval policy', async () => {
    const all = await lines(paginated)
    expect(parseCodexMeta(all[3]!)).toEqual({
      approvalPolicy: 'on-request',
      permissionProfile: ':workspace',
      status: { model: 'gpt-5.5-codex', effort: 'medium' },
    })
    expect(parseCodexMeta(all[19]!)).toEqual({ approvalPolicy: 'never', status: { model: 'gpt-5.5-codex' } })
    expect(parseCodexMeta(all[5]!)).toBeNull()
    expect(approvalPolicyName({ granular: { rules: true } })).toBe('granular')
    expect(approvalPolicyName(3)).toBeNull()
  })

  test('permission profile: the active one, else the sandbox policy of a turn', () => {
    const applied = JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'thread_settings_applied',
        thread_settings: { approval_policy: 'on-request', active_permission_profile: { id: ':read-only' } },
      },
    })
    expect(parseCodexMeta(applied)).toEqual({ approvalPolicy: 'on-request', permissionProfile: ':read-only' })
    const turn = (payload: object) =>
      JSON.stringify({ type: 'turn_context', payload: { model: 'm', ...payload } })
    expect(
      parseCodexMeta(
        turn({ sandbox_policy: { type: 'workspace-write' }, active_permission_profile: { id: 'locked' } }),
      ),
    ).toMatchObject({ permissionProfile: 'locked' })
    expect(parseCodexMeta(turn({ sandbox_policy: { type: 'danger-full-access' } }))).toMatchObject({
      permissionProfile: ':danger-full-access',
    })
    expect(parseCodexMeta(turn({ sandbox_policy: { type: 'external-sandbox' } }))).not.toHaveProperty(
      'permissionProfile',
    )
  })

  test('meta from head and tail', async () => {
    const all = await lines(paginated)
    expect(extractCodexMeta(all.slice(0, 8), all.slice(-4))).toEqual({
      id: '0199fd2a-7c1e-7a33-9a0e-5b0f2c1d4e6f',
      cwd: '/Users/me/proj',
      firstPrompt: 'run the tests',
      approvalPolicy: 'never',
      permissionProfile: ':workspace',
      status: { model: 'gpt-5.5-codex', effort: 'medium', context: null },
      limits: null,
    })
    const old = await lines(legacy)
    expect(extractCodexMeta(old, [])).toMatchObject({
      cwd: '/Users/me/old',
      firstPrompt: 'list files',
      approvalPolicy: 'untrusted',
      permissionProfile: ':read-only',
      status: { model: 'gpt-5', effort: null, context: null },
      limits: null,
    })
  })

  test('thread names: last wins', () => {
    const index = [
      '{"id":"a","thread_name":"First","updated_at":"1"}',
      '{"id":"b","thread_name":"Other","updated_at":"2"}',
      '{"id":"a","thread_name":"Renamed","updated_at":"3"}',
    ]
    expect(threadName(index, 'a')).toBe('Renamed')
    expect(threadName(index, 'c')).toBeNull()
  })

  test('rollout file names', () => {
    expect(rolloutSessionId('rollout-2026-10-19T14-37-08-0199fd2a-7c1e-7a33-9a0e-5b0f2c1d4e6f.jsonl')).toBe(
      '0199fd2a-7c1e-7a33-9a0e-5b0f2c1d4e6f',
    )
    expect(
      rolloutSessionId(
        'rollout-2026-10-19T14-37-08-0199fd2a-7c1e-7a33-9a0e-5b0f2c1d4e6f_0199fd2b-0000-7000-8000-000000000000.jsonl',
      ),
    ).toBe('0199fd2a-7c1e-7a33-9a0e-5b0f2c1d4e6f')
    expect(rolloutSessionId('rollout-2026-10-19T14-37-08-x.jsonl')).toBeNull()
    expect(rolloutSessionId('session_index.jsonl')).toBeNull()
  })

  test('patch files and tool outputs', () => {
    expect(
      patchFiles(
        '*** Begin Patch\n*** Add File: a.ts\n+x\n*** Update File: b.ts\n*** Move to: c.ts\n*** Delete File: d.ts\n',
      ),
    ).toEqual(['a.ts', 'b.ts', 'd.ts', 'c.ts'])
    expect(toolOutput('plain')).toEqual({ text: 'plain', isError: false })
    expect(toolOutput('Wall time: 1s\nProcess running with session ID 3\nOutput:\npartial')).toEqual({
      text: 'partial',
      isError: false,
    })
    expect(toolOutput('{"output":"x","metadata":{"exit_code":2}}')).toEqual({ text: 'x', isError: true })
  })
})

const T = '2026-10-21T12:00:00.000Z'
const tokenCount = (info: unknown, rateLimits: unknown) =>
  JSON.stringify({
    timestamp: T,
    type: 'event_msg',
    payload: { type: 'token_count', info, rate_limits: rateLimits },
  })
const usage = (total: number) => ({
  input_tokens: total - 500,
  cached_input_tokens: 0,
  output_tokens: 500,
  reasoning_output_tokens: 0,
  total_tokens: total,
})

describe('codex status', () => {
  test('context from the last turn, with the TUI baseline', () => {
    const line = tokenCount(
      { total_token_usage: usage(900_000), last_token_usage: usage(72_000), model_context_window: 272_000 },
      null,
    )
    const meta = parseCodexMeta(line)
    expect(meta?.limits).toBeUndefined()
    expect(meta?.status?.context?.usedTokens).toBe(72_000)
    expect(meta?.status?.context?.size).toBe(272_000)
    expect(meta?.status?.context?.percent).toBeCloseTo(23.077, 2)
    // Below the baseline reads as empty; past the window as full.
    const low = parseCodexMeta(
      tokenCount({ last_token_usage: usage(5_000), model_context_window: 272_000 }, null),
    )
    expect(low?.status?.context?.percent).toBe(0)
    const full = parseCodexMeta(
      tokenCount({ last_token_usage: usage(400_000), model_context_window: 272_000 }, null),
    )
    expect(full?.status?.context?.percent).toBe(100)
    expect(
      parseCodexMeta(
        tokenCount({ last_token_usage: usage(1_000), model_context_window: CONTEXT_BASELINE_TOKENS }, null),
      ),
    ).toBeNull()
  })

  test('rate limits by window length', () => {
    const line = tokenCount(null, {
      primary: { used_percent: 12, window_minutes: 300, resets_at: 1_792_000_000 },
      secondary: { used_percent: 40.5, window_minutes: 10_080, resets_at: 1_792_400_000 },
    })
    expect(parseCodexMeta(line)).toEqual({
      limits: {
        fiveHour: { percent: 12, resetsAt: 1_792_000_000_000 },
        sevenDay: { percent: 40.5, resetsAt: 1_792_400_000_000 },
      },
    })
    // A weekly primary (no 5-hour window on the plan) goes to the 7-day slot.
    const weekly = parseCodexMeta(
      tokenCount(null, { primary: { used_percent: 7, window_minutes: 10_080, resets_at: 1_792_400_000 } }),
    )
    expect(weekly?.limits).toEqual({ fiveHour: null, sevenDay: { percent: 7, resetsAt: 1_792_400_000_000 } })
  })

  test('older reset fields and missing lengths', () => {
    const at = Date.parse(T)
    const line = tokenCount(null, {
      primary: { used_percent: 30, resets_in_seconds: 600 },
      secondary: { used_percent: 5, window_minutes: null, resets_in_seconds: 86_400 },
    })
    expect(parseCodexMeta(line)?.limits).toEqual({
      fiveHour: { percent: 30, resetsAt: at + 600_000 },
      sevenDay: { percent: 5, resetsAt: at + 86_400_000 },
    })
    // Without a reset time a window is unknown.
    expect(
      parseCodexMeta(tokenCount(null, { primary: { used_percent: 30, window_minutes: 300 } })),
    ).toBeNull()
  })

  test('unknown items stay unknown', () => {
    expect(parseCodexMeta(tokenCount(null, null))).toBeNull()
    expect(parseCodexMeta(tokenCount({ model_context_window: 'x' }, { primary: 'nope' }))).toBeNull()
    expect(codexLineStatus({ type: 'turn_context', payload: { cwd: '/x' } })).toBeNull()
    expect(codexLineStatus({ type: 'event_msg', payload: { type: 'agent_message' } })).toBeNull()
  })

  test('the tail wins over the head', () => {
    const head = [
      JSON.stringify({ type: 'session_meta', payload: { id: 's', cwd: '/p' } }),
      JSON.stringify({ type: 'turn_context', payload: { model: 'gpt-5.5-codex', effort: 'low' } }),
    ]
    const tail = [
      JSON.stringify({ type: 'turn_context', payload: { model: 'gpt-5.5-codex', effort: 'high' } }),
      tokenCount(
        { last_token_usage: usage(142_000), model_context_window: 272_000 },
        { primary: { used_percent: 50, window_minutes: 300, resets_at: 1_792_000_000 } },
      ),
    ]
    const meta = extractCodexMeta(head, tail)
    expect(meta.status).toEqual({
      model: 'gpt-5.5-codex',
      effort: 'high',
      context: { usedTokens: 142_000, size: 272_000, percent: 50 },
    })
    expect(meta.limits).toEqual({ fiveHour: { percent: 50, resetsAt: 1_792_000_000_000 }, sevenDay: null })
  })
})
