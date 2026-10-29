import { describe, expect, test } from 'vitest'
import {
  acceptsHook,
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
