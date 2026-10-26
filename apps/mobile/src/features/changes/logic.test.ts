import type { ChangedFile } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { changeTotals, LARGE_DIFF_LINES, refreshDue, startsCollapsed, unifiedDiffLines } from './logic'

const file = (over: Partial<ChangedFile>): ChangedFile => ({
  path: 'src/a.ts',
  oldPath: null,
  status: 'modified',
  added: 3,
  deleted: 1,
  binary: false,
  generated: false,
  untracked: false,
  ...over,
})

describe('unifiedDiffLines', () => {
  test('drops headers and separates hunks', () => {
    const lines = [
      'diff --git a/src/a.ts b/src/a.ts',
      'index 1111..2222 100644',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,3 +1,3 @@',
      ' one',
      '-two',
      '+2',
      '@@ -10,2 +10,3 @@ function x() {',
      ' ten',
      '+eleven',
      '\\ No newline at end of file',
    ]
    expect(unifiedDiffLines(lines)).toEqual([
      { kind: 'context', text: 'one' },
      { kind: 'remove', text: 'two' },
      { kind: 'add', text: '2' },
      { kind: 'context', text: '⋯' },
      { kind: 'context', text: 'ten' },
      { kind: 'add', text: 'eleven' },
    ])
  })

  test('a rename without content changes has no lines', () => {
    expect(
      unifiedDiffLines([
        'diff --git a/old.ts b/new.ts',
        'similarity index 100%',
        'rename from old.ts',
        'rename to new.ts',
      ]),
    ).toEqual([])
  })

  test('a page that starts mid-hunk keeps its lines', () => {
    expect(unifiedDiffLines(['+a', ' b'])).toEqual([
      { kind: 'add', text: 'a' },
      { kind: 'context', text: 'b' },
    ])
  })
})

describe('collapse and totals', () => {
  test('generated, binary, unknown and large files start collapsed', () => {
    expect(startsCollapsed(file({}))).toBe(false)
    expect(startsCollapsed(file({ generated: true }))).toBe(true)
    expect(startsCollapsed(file({ binary: true, added: null, deleted: null }))).toBe(true)
    expect(startsCollapsed(file({ added: null }))).toBe(true)
    expect(startsCollapsed(file({ added: LARGE_DIFF_LINES, deleted: 1 }))).toBe(true)
    expect(startsCollapsed(file({ added: LARGE_DIFF_LINES, deleted: 0 }))).toBe(false)
  })

  test('totals skip unknown counts', () => {
    expect(
      changeTotals([file({}), file({ added: null, deleted: null }), file({ added: 2, deleted: 0 })]),
    ).toEqual({
      files: 3,
      added: 5,
      deleted: 1,
    })
  })

  test('refresh throttle', () => {
    expect(refreshDue(null, 0, 3000)).toBe(true)
    expect(refreshDue(1000, 3999, 3000)).toBe(false)
    expect(refreshDue(1000, 4000, 3000)).toBe(true)
  })
})
