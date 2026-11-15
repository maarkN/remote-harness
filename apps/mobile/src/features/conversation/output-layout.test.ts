import { describe, expect, it } from 'vitest'
import { outputWraps } from './output-layout'

describe('outputWraps', () => {
  it('keeps the lines of output whose columns matter', () => {
    for (const tool of [
      'Bash',
      'BashOutput',
      'Grep',
      'Glob',
      'Read',
      'LS',
      'NotebookRead',
      'exec',
      'apply_patch',
    ])
      expect(outputWraps(tool)).toBe(false)
  })

  it('wraps prose output: subagents, the web, MCP and unknown tools', () => {
    for (const tool of [
      'Task',
      'Agent',
      'WebFetch',
      'WebSearch',
      'Edit',
      'mcp__github__get_issue',
      'Whatever',
    ])
      expect(outputWraps(tool)).toBe(true)
    expect(outputWraps(undefined)).toBe(true)
  })
})
