import { describe, expect, test } from 'vitest'
import {
  appendOutput,
  appendToDraft,
  type CommandExit,
  exitFailed,
  formatElapsed,
  MAX_DISPLAY_CHARS,
  MAX_PROMPT_CHARS,
  newRun,
  outputText,
  promptBlock,
} from './logic'

const exited = (code: number): CommandExit => ({
  exitCode: code,
  signal: null,
  reason: 'exited',
  durationMs: 10,
  truncated: false,
})

describe('command output', () => {
  test('merges neighbors of the same stream', () => {
    let run = newRun('r', 'ls', '/w', 0)
    run = appendOutput(run, 'stdout', 'a')
    run = appendOutput(run, 'stdout', 'b')
    run = appendOutput(run, 'stderr', 'c')
    run = appendOutput(run, 'stdout', '')
    expect(run.segments).toEqual([
      { stream: 'stdout', text: 'ab' },
      { stream: 'stderr', text: 'c' },
    ])
    expect(outputText(run)).toBe('abc')
  })

  test('keeps the end of long output', () => {
    let run = newRun('r', 'yes', '/w', 0)
    run = appendOutput(run, 'stderr', 'x'.repeat(10))
    run = appendOutput(run, 'stdout', 'y'.repeat(MAX_DISPLAY_CHARS))
    expect(outputText(run)).toHaveLength(MAX_DISPLAY_CHARS)
    expect(run.segments).toEqual([{ stream: 'stdout', text: 'y'.repeat(MAX_DISPLAY_CHARS) }])
    expect(run.clipped).toBe(true)
  })

  test('failure: any non-zero exit or a killed run', () => {
    expect(exitFailed(exited(0))).toBe(false)
    expect(exitFailed(exited(1))).toBe(true)
    expect(exitFailed({ ...exited(0), reason: 'cancelled', exitCode: null })).toBe(true)
  })
})

describe('prompt block', () => {
  test('command, output and exit status in a fence', () => {
    let run = newRun('r', 'git status', '/w', 0)
    run = appendOutput(run, 'stdout', 'On branch main\n\n')
    run = { ...run, exit: exited(0) }
    expect(promptBlock(run)).toBe('```shell\n$ git status\nOn branch main\n[exit 0]\n```')
  })

  test('killed runs say why; empty output adds no blank line', () => {
    const run = { ...newRun('r', 'sleep 9', '/w', 0), exit: { ...exited(0), reason: 'timeout' as const } }
    expect(promptBlock(run)).toBe('```shell\n$ sleep 9\n[timed out]\n```')
  })

  test('the fence outgrows backticks in the output', () => {
    let run = newRun('r', 'cat README.md', '/w', 0)
    run = appendOutput(run, 'stdout', '```ts\ncode\n```\n')
    run = { ...run, exit: exited(0) }
    expect(promptBlock(run).startsWith('````shell\n')).toBe(true)
    expect(promptBlock(run).endsWith('\n````')).toBe(true)
  })

  test('long output keeps its end', () => {
    let run = newRun('r', 'pnpm test', '/w', 0)
    run = appendOutput(run, 'stdout', `${'a'.repeat(MAX_PROMPT_CHARS)}END`)
    run = { ...run, exit: exited(1) }
    const block = promptBlock(run)
    expect(block).toContain('$ pnpm test\n…\n')
    expect(block).toContain('END\n[exit 1]')
    expect(block.length).toBeLessThan(MAX_PROMPT_CHARS + 100)
  })

  test('appended to the draft after a blank line', () => {
    expect(appendToDraft('', 'B')).toBe('B')
    expect(appendToDraft('look at this  \n', 'B')).toBe('look at this\n\nB')
  })
})

test('elapsed time', () => {
  expect(formatElapsed(12_400)).toBe('12s')
  expect(formatElapsed(65_000)).toBe('1:05')
})
