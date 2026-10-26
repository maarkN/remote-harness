import type { ApprovalEntry, Profile, RuleFile } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { canCheckIdentity } from '@/core/auth/identity'
import {
  appRuleIds,
  approvalLabel,
  approvalSubject,
  ruleFileTitle,
  sortRuleFiles,
  undoableRuleId,
} from './rules'

const profiles: Profile[] = [
  { id: 'work', name: 'Work', configDir: '/w', color: '' },
  { id: 'home', name: 'Home', configDir: '/h', color: '' },
]
const file = (over: Partial<RuleFile>): RuleFile => ({
  file: '/f',
  scope: 'project',
  profileId: null,
  project: '/p',
  rules: [],
  ...over,
})
const entry = (over: Partial<ApprovalEntry>): ApprovalEntry => ({
  id: 'e',
  at: '2026-10-25T10:00:00.000Z',
  action: 'allow',
  device: null,
  sessionId: 's',
  folder: 'app',
  tool: 'Bash',
  target: 'git commit',
  rule: null,
  ruleId: null,
  ...over,
})

describe('rule files', () => {
  test('profiles first in daemon order, then projects by path', () => {
    const files = [
      file({ file: '/z', project: '/z' }),
      file({ file: '/h', scope: 'profile', profileId: 'home', project: null }),
      file({ file: '/a', project: '/a' }),
      file({ file: '/w', scope: 'profile', profileId: 'work', project: null }),
    ]
    expect(sortRuleFiles(files, profiles).map((f) => f.file)).toEqual(['/w', '/h', '/a', '/z'])
  })

  test('titles and app rule IDs', () => {
    expect(ruleFileTitle(file({ scope: 'profile', profileId: 'home', project: null }), profiles)).toBe('Home')
    expect(ruleFileTitle(file({ scope: 'profile', profileId: 'gone', project: null }), profiles)).toBe('gone')
    expect(ruleFileTitle(file({ project: '/p' }), profiles)).toBe('/p')
    const files = [
      file({
        rules: [
          { origin: 'app', rule: 'Edit', ruleId: 'r1', createdAt: '' },
          { origin: 'hand', rule: 'Read' },
        ],
      }),
    ]
    expect([...appRuleIds(files)]).toEqual(['r1'])
  })
})

describe('approval entries', () => {
  test('label and subject', () => {
    expect(approvalLabel(entry({}))).toBe('allow')
    expect(approvalLabel(entry({ always: true }))).toBe('allowAlways')
    expect(approvalLabel(entry({ action: 'delete' }))).toBe('delete')
    expect(approvalSubject(entry({}))).toBe('Bash · git commit')
    expect(approvalSubject(entry({ target: null }))).toBe('Bash')
    expect(approvalSubject(entry({ action: 'undo', rule: 'Bash(ls:*)', target: null }))).toBe('Bash(ls:*)')
  })

  test('undo only on an allow always whose rule is still app-created', () => {
    const ids = new Set(['r1'])
    expect(undoableRuleId(entry({ always: true, ruleId: 'r1' }), ids)).toBe('r1')
    expect(undoableRuleId(entry({ always: true, ruleId: 'r2' }), ids)).toBeNull()
    expect(undoableRuleId(entry({ ruleId: 'r1' }), ids)).toBeNull()
    expect(undoableRuleId(entry({ action: 'undo', ruleId: 'r1' }), ids)).toBeNull()
  })

  test('a device without a lock cannot check identity', () => {
    expect(canCheckIdentity(0)).toBe(false)
    expect(canCheckIdentity(1)).toBe(true)
    expect(canCheckIdentity(3)).toBe(true)
  })
})
