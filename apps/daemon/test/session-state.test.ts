import { describe, expect, test } from 'vitest'
import {
  acceptsHook,
  agentWorkInFlight,
  hookState,
  justEnded,
  revives,
  stateAfterPermission,
  stateAfterResolution,
} from '../src/features/sessions/state.ts'

describe('session state rules', () => {
  test('hookState maps hooks to states', () => {
    expect(hookState('SessionStart')).toBe('idle')
    expect(hookState('Stop')).toBe('idle')
    expect(hookState('UserPromptSubmit')).toBe('running')
    expect(hookState('PermissionRequest')).toBe('waiting')
    expect(hookState('Notification', 'idle_prompt')).toBe('waiting')
    expect(hookState('Notification', 'auth_success')).toBeUndefined()
    expect(hookState('SessionEnd')).toBe('ended')
    expect(hookState('PreToolUse')).toBeUndefined()
    // Codex: a turn paused instead of finishing (e.g. to ask a question) is still ready for input.
    expect(hookState('Interrupt')).toBe('idle')
  })

  test('a Stop with agents still working in the background keeps the session running', () => {
    const workflow = { id: 'w1', type: 'workflow', status: 'running', description: 'review', name: 'review' }
    const subagent = {
      id: 'a1',
      type: 'subagent',
      status: 'pending',
      description: 'x',
      agent_type: 'Explore',
    }
    const shell = { id: 'b1', type: 'shell', status: 'running', description: 'dev', command: 'pnpm dev' }
    const monitor = { id: 'm1', type: 'monitor', status: 'running', description: 'watch' }
    expect(hookState('Stop', undefined, [workflow])).toBe('running')
    expect(hookState('Stop', undefined, [shell, subagent])).toBe('running')
    // Shells and monitors can run for hours: the session is ready for a prompt meanwhile.
    expect(hookState('Stop', undefined, [shell, monitor])).toBe('idle')
    expect(hookState('Stop', undefined, [{ ...workflow, status: 'completed' }])).toBe('idle')
    expect(hookState('Stop', undefined, [])).toBe('idle')
    // Codex sends no list; unknown shapes count as no agent work.
    expect(hookState('Stop', undefined, undefined)).toBe('idle')
    expect(hookState('Stop', undefined, [null, 'workflow', { type: 1 }])).toBe('idle')
    expect(agentWorkInFlight({ type: 'workflow' })).toBe(false)
    // Only Stop looks at the list.
    expect(hookState('SessionStart', undefined, [workflow])).toBe('idle')
  })

  test('an ended session only accepts a new start or a prompt from a pane', () => {
    const ended = { state: 'ended' as const }
    expect(acceptsHook(ended, 'Notification', true)).toBe(false)
    expect(acceptsHook(ended, 'PermissionRequest', true)).toBe(false)
    expect(acceptsHook(ended, 'Stop', true)).toBe(false)
    expect(acceptsHook(ended, 'UserPromptSubmit', false)).toBe(false)
    expect(acceptsHook(ended, 'UserPromptSubmit', true)).toBe(true)
    expect(acceptsHook(ended, 'SessionStart', false)).toBe(true)
    expect(acceptsHook({ state: 'idle' }, 'Notification', false)).toBe(true)
    expect(acceptsHook(undefined, 'Notification', false)).toBe(true)
    expect(revives('SessionStart', false)).toBe(true)
  })

  test('a permission resolution sets running unless the session ended', () => {
    expect(stateAfterPermission({ state: 'waiting' })).toBe('running')
    expect(stateAfterPermission({ state: 'ended' })).toBeUndefined()
    expect(stateAfterPermission(undefined)).toBeUndefined()
    expect(stateAfterResolution({ state: 'waiting' }, 'allowed')).toBe('running')
    expect(stateAfterResolution({ state: 'waiting' }, 'cancelled')).toBeUndefined()
    expect(stateAfterResolution({ state: 'waiting' }, 'expired')).toBeUndefined()
    // Answered in the terminal and the turn went on (#437).
    expect(stateAfterResolution({ state: 'waiting' }, 'cancelled', true)).toBe('running')
    expect(stateAfterResolution({ state: 'ended' }, 'cancelled', true)).toBeUndefined()
  })

  test('justEnded flags only the transition into ended', () => {
    expect(justEnded({ state: 'ended' }, { state: 'waiting' })).toBe(true)
    expect(justEnded({ state: 'ended' }, { state: 'ended' })).toBe(false)
    expect(justEnded({ state: 'ended' }, undefined)).toBe(false)
    expect(justEnded({ state: 'idle' }, { state: 'running' })).toBe(false)
  })
})
