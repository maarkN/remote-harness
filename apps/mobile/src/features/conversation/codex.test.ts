import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import { canStartInWorktree } from '../lifecycle/new-session'
import {
  approvalPolicyTone,
  CODEX_PRESETS,
  codexPermissionsLabel,
  codexPermissionsTone,
  codexPresetOf,
  hasSwitchableModes,
} from '../mode/modes'
import { diffForTool } from './diff'
import { patchDiff, patchFiles, patchText } from './patch'
import { summarizeTool } from './summarize-tool'
import { systemText } from './timeline'
import { toolInputFields } from './tool-details'

const t = createI18n('en-US').t
const patch =
  '*** Begin Patch\n*** Update File: src/app.css\n@@\n-module.exports = {}\n+@import "tailwindcss";\n keep\n*** End Patch'

describe('codex tool calls', () => {
  test('exec reads like a shell command', () => {
    expect(summarizeTool('exec', { command: 'pnpm dlx @tailwindcss/upgrade', workdir: '/w' }, t)).toBe(
      'exec(pnpm dlx @tailwindcss/upgrade)',
    )
    expect(toolInputFields('exec', { command: 'ls', workdir: '/w' })).toEqual([
      { field: 'command', value: 'ls' },
      { field: 'folder', value: '/w' },
    ])
  })

  test('apply_patch names the files and shows the patch as a diff', () => {
    const input = { files: ['tailwind.config.ts', 'src/app.css'], patch }
    expect(summarizeTool('apply_patch', input, t)).toBe('apply_patch(tailwind.config.ts, app.css)')
    expect(toolInputFields('apply_patch', input)).toEqual([
      { field: 'files', value: 'tailwind.config.ts\nsrc/app.css' },
    ])
    expect(diffForTool('apply_patch', input, t)).toEqual([
      { kind: 'context', text: 'src/app.css' },
      { kind: 'context', text: '⋯' },
      { kind: 'remove', text: 'module.exports = {}' },
      { kind: 'add', text: '@import "tailwindcss";' },
      { kind: 'context', text: 'keep' },
    ])
  })

  test('a permission request carries the patch as command', () => {
    expect(patchText({ command: patch })).toBe(patch)
    expect(patchFiles({ command: patch })).toEqual(['src/app.css'])
    expect(summarizeTool('apply_patch', { command: patch }, t)).toBe('apply_patch(app.css)')
    expect(patchText({ command: 'ls' })).toBeNull()
    expect(diffForTool('apply_patch', { command: 'ls' }, t)).toBeNull()
  })

  test('moves and adds', () => {
    expect(patchFiles({ patch: '*** Update File: a.ts\n*** Move to: b.ts\n*** Add File: c.ts\n+x' })).toEqual(
      ['a.ts', 'b.ts', 'c.ts'],
    )
    expect(patchDiff('*** Update File: a.ts\n*** Move to: b.ts')).toEqual([
      { kind: 'context', text: 'a.ts' },
      { kind: 'context', text: '→ b.ts' },
    ])
  })

  test('web search shows the query', () => {
    expect(summarizeTool('web_search', { query: 'codex cli' }, t)).toBe('web_search(codex cli)')
  })

  test('interrupted turns are translated', () => {
    expect(systemText({ subtype: 'turn_aborted', text: 'Interrupted' }, createI18n('pt-BR').t)).toBe(
      'Interrompido',
    )
    expect(systemText({ subtype: 'turn_aborted', text: 'Turn ended: replaced' }, t)).toBe(
      'Turn ended: replaced',
    )
  })
})

describe('codex modes and new session', () => {
  test('only Claude Code modes are switched from the app', () => {
    expect(hasSwitchableModes('claude')).toBe(true)
    expect(hasSwitchableModes(null)).toBe(true)
    expect(hasSwitchableModes('codex')).toBe(false)
  })

  test('approval policy tones', () => {
    expect(approvalPolicyTone('never')).toBe('danger')
    expect(approvalPolicyTone('on-request')).toBe('accent')
    expect(approvalPolicyTone('untrusted')).toBe('muted')
    expect(approvalPolicyTone(null)).toBe('muted')
  })

  test('worktree option for Claude Code and Codex', () => {
    expect(canStartInWorktree('claude')).toBe(true)
    expect(canStartInWorktree('codex')).toBe(true)
    expect(canStartInWorktree('kimi')).toBe(false)
  })

  test('permissions chip: built-in profiles translated, named ones as is, else the policy', () => {
    const t = createI18n('en-US').t
    expect(codexPermissionsLabel(':workspace', 'on-request', t)).toBe('workspace')
    expect(codexPermissionsLabel(':read-only', 'on-request', t)).toBe('read only')
    expect(codexPermissionsLabel(':danger-full-access', 'never', t)).toBe('full access')
    expect(codexPermissionsLabel('locked-down', 'on-request', t)).toBe('locked-down')
    expect(codexPermissionsLabel(null, 'untrusted', t)).toBe('untrusted')
    expect(codexPermissionsLabel(null, null, t)).toBe('—')
    expect(createI18n('pt-BR').t('mode.codex.labels.fullAccess')).toBe('acesso total')
  })

  test('permissions chip tones', () => {
    expect(codexPermissionsTone(':danger-full-access', 'on-request')).toBe('danger')
    expect(codexPermissionsTone(':workspace', 'never')).toBe('danger')
    expect(codexPermissionsTone(':read-only', 'on-request')).toBe('muted')
    expect(codexPermissionsTone(':workspace', 'on-request')).toBe('accent')
    expect(codexPermissionsTone(null, 'on-request')).toBe('accent')
  })

  test('presets: never full access; the current one from the profile', () => {
    expect(CODEX_PRESETS).toEqual(['read-only', 'workspace'])
    expect(codexPresetOf(':read-only')).toBe('read-only')
    expect(codexPresetOf(':workspace')).toBe('workspace')
    expect(codexPresetOf(':danger-full-access')).toBeNull()
    expect(codexPresetOf(null)).toBeNull()
  })
})
