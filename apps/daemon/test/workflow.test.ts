import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { MAX_TASK_RESULT_CHARS, parseTranscriptLine } from '../src/features/transcript/parser.ts'
import { workflowCall, workflowLaunch } from '../src/features/transcript/workflow.ts'

const fixture = join(import.meta.dirname, 'fixtures', 'workflow-run.jsonl')

async function fixtureEntries() {
  const lines = (await readFile(fixture, 'utf8')).split('\n').filter(Boolean)
  return lines.flatMap((line, cursor) => parseTranscriptLine(line, cursor))
}

describe('workflow run in the transcript (#440)', () => {
  test('the Workflow call carries the meta of its script', async () => {
    const entries = await fixtureEntries()
    const call = entries.find((e) => e.kind === 'tool_use' && e.name === 'Workflow')
    expect(call).toMatchObject({
      kind: 'tool_use',
      toolUseId: 'toolu_wf1',
      workflow: {
        name: 'review-changes',
        description: 'Review changed files across dimensions, verify each finding',
        phases: [
          { title: 'Review', detail: null },
          { title: 'Verify', detail: 'one agent per finding' },
        ],
      },
    })
  })

  test('the launch result names the task, the run and the summary', async () => {
    const entries = await fixtureEntries()
    const launch = entries.find((e) => e.kind === 'tool_result' && e.toolUseId === 'toolu_wf1')
    expect(launch).toMatchObject({
      workflow: {
        taskId: 'w0000001',
        runId: 'wf_00000001-abc',
        summary: 'Review changed files across dimensions, verify each finding',
      },
    })
  })

  test('the final notification keeps the tool use id and the result, not the task id or the file', async () => {
    const entries = await fixtureEntries()
    const done = entries.find((e) => e.kind === 'system' && e.subtype === 'task_notification')
    expect(done).toMatchObject({
      status: 'completed',
      toolUseId: 'toolu_wf1',
      text: 'Dynamic workflow "Review changed files across dimensions, verify each finding" completed',
      result: '{"confirmed":[{"title":"Null check missing","file":"a.ts"}]}',
    })
    const json = JSON.stringify(done)
    expect(json).not.toContain('w0000001')
    expect(json).not.toContain('/tmp/project/tasks')
  })

  test('ordinary tools carry no workflow field', async () => {
    const entries = await fixtureEntries()
    for (const entry of entries) {
      if (entry.kind === 'tool_use' && entry.name !== 'Workflow') expect(entry).not.toHaveProperty('workflow')
      if (entry.kind === 'tool_result' && entry.toolUseId !== 'toolu_wf1')
        expect(entry).not.toHaveProperty('workflow')
    }
  })
})

describe('workflowCall', () => {
  test('reads name, description and phases from a meta literal with mixed quotes and nesting', () => {
    const script = [
      'export const meta = {',
      "  name: 'deliver-changes',",
      '  description: `Implement, then review: it\\`s long`,',
      '  phases: [',
      '    { title: \'Implement\', detail: "one agent per change {with braces}" },',
      "    { title: 'Review' },",
      '  ],',
      '}',
      "const x = { name: 'not the meta', phases: [] }",
    ].join('\n')
    expect(workflowCall({ script })).toEqual({
      name: 'deliver-changes',
      description: 'Implement, then review: it`s long',
      phases: [
        { title: 'Implement', detail: 'one agent per change {with braces}' },
        { title: 'Review', detail: null },
      ],
    })
  })

  test('a phase detail mentioning "name:" does not become the workflow name', () => {
    const script = "export const meta = { phases: [{ title: 'A', detail: 'name: x, description: y' }] }"
    expect(workflowCall({ script })).toEqual({
      name: null,
      description: null,
      phases: [{ title: 'A', detail: 'name: x, description: y' }],
    })
  })

  test('a script by path or a saved workflow', () => {
    expect(workflowCall({ scriptPath: '/tmp/wf.js', args: {} })).toEqual({
      name: null,
      description: null,
      phases: [],
    })
    expect(workflowCall({ name: ' review-pr ' })).toEqual({
      name: 'review-pr',
      description: null,
      phases: [],
    })
  })

  test('a malformed or missing meta yields nulls, never an error', () => {
    expect(workflowCall({ script: 'export const meta = { name: "x", phases: [ { title: "A" ' })).toEqual({
      name: null,
      description: null,
      phases: [],
    })
    expect(workflowCall({ script: 'const meta = { name: "x" }' })).toEqual({
      name: null,
      description: null,
      phases: [],
    })
    expect(workflowCall({})).toEqual({ name: null, description: null, phases: [] })
  })
})

describe('workflowLaunch', () => {
  test('reads the task id, the run folder and the summary', () => {
    const text = [
      'Workflow launched in background. Task ID: w9',
      'Summary: Port the components',
      'Transcript dir: /Users/u/.claude/projects/p/s/subagents/workflows/wf_e89474ab-b71',
      'Script file: /Users/u/.claude/projects/p/s/subagents/workflows/wf_e89474ab-b71/script.js',
    ].join('\n')
    expect(workflowLaunch(text)).toEqual({
      taskId: 'w9',
      runId: 'wf_e89474ab-b71',
      summary: 'Port the components',
    })
  })

  test('fields the text does not name are null; other results are not launches', () => {
    expect(workflowLaunch('Workflow launched in background.')).toEqual({
      taskId: null,
      runId: null,
      summary: null,
    })
    expect(workflowLaunch('Done. Workflow launched in background. Task ID: w1')).toBeNull()
    expect(workflowLaunch('total 0')).toBeNull()
  })
})

describe('task notification result', () => {
  test('is cut at the limit', () => {
    const long = 'x'.repeat(MAX_TASK_RESULT_CHARS + 10)
    const line = JSON.stringify({
      type: 'user',
      uuid: 'u',
      message: {
        role: 'user',
        content: `<task-notification><status>completed</status><summary>ok</summary><result>${long}</result></task-notification>`,
      },
    })
    const [entry] = parseTranscriptLine(line, 0)
    expect(entry?.kind === 'system' && entry.result?.length).toBe(MAX_TASK_RESULT_CHARS)
  })
})
