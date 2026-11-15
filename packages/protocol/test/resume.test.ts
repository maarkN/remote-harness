import { describe, expect, test } from 'vitest'
import { AgentIdSchema } from '../src/domain.ts'
import { resumeArgs } from '../src/resume.ts'

describe('resumeArgs', () => {
  test("each agent's own arguments", () => {
    expect(resumeArgs('claude', 'abc')).toEqual(['--resume', 'abc'])
    expect(resumeArgs('codex', 'abc')).toEqual(['resume', 'abc'])
    expect(resumeArgs('gemini', 'abc')).toEqual(['--resume', 'abc'])
    expect(resumeArgs('kimi', 'abc')).toEqual(['--session', 'abc'])
    expect(resumeArgs('qwen', 'abc')).toEqual(['--resume', 'abc'])
  })

  test('every agent has an entry', () => {
    for (const agent of AgentIdSchema.options) expect(resumeArgs(agent, 'id')).toContain('id')
  })
})
