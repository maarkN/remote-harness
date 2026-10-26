import { execFileSync } from 'node:child_process'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CHANGES_DIFF_PAGE } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { ChangesService, textStats } from '../src/features/changes/service.ts'
import type { SessionRecord } from '../src/features/sessions/types.ts'
import { execaExecutor } from '../src/infra/exec.ts'
import { EMPTY_TREE, GitClient, isGeneratedPath, parseNameStatus, parseNumstat } from '../src/infra/git.ts'
import { useTempHome } from './helpers.ts'

describe('git diff parsing', () => {
  test('name-status with renames, copies, deletions and type changes', () => {
    const out = [
      'M',
      'src/a.ts',
      'R087',
      'old.ts',
      'new.ts',
      'A',
      'b.ts',
      'D',
      'gone.ts',
      'C100',
      'x',
      'y',
      'T',
      'link',
      '',
    ].join('\0')
    expect(parseNameStatus(out)).toEqual([
      { path: 'src/a.ts', oldPath: null, status: 'modified' },
      { path: 'new.ts', oldPath: 'old.ts', status: 'renamed' },
      { path: 'b.ts', oldPath: null, status: 'added' },
      { path: 'gone.ts', oldPath: null, status: 'deleted' },
      { path: 'y', oldPath: null, status: 'added' },
      { path: 'link', oldPath: null, status: 'modified' },
    ])
    expect(parseNameStatus('')).toEqual([])
  })

  test('numstat with renames, binary files and tabs in names', () => {
    const out = [
      '3\t1\tsrc/a.ts',
      '0\t0\t',
      'old.ts',
      'new.ts',
      '-\t-\timg.png',
      '2\t0\tweird\tname',
      '',
    ].join('\0')
    const stats = parseNumstat(out)
    expect(stats.get('src/a.ts')).toEqual({ added: 3, deleted: 1, binary: false })
    expect(stats.get('new.ts')).toEqual({ added: 0, deleted: 0, binary: false })
    expect(stats.get('img.png')).toEqual({ added: null, deleted: null, binary: true })
    expect(stats.get('weird\tname')).toEqual({ added: 2, deleted: 0, binary: false })
    expect(stats.has('old.ts')).toBe(false)
  })

  test('generated paths', () => {
    for (const path of [
      'pnpm-lock.yaml',
      'apps/x/package-lock.json',
      'src/a.generated.ts',
      'dist/cli.js',
      'apps/web/build/x.css',
      'a.min.js',
      'b.js.map',
      'go.sum',
    ])
      expect(isGeneratedPath(path), path).toBe(true)
    for (const path of ['src/a.ts', 'distance.ts', 'docs/build.md', 'README.md'])
      expect(isGeneratedPath(path), path).toBe(false)
  })

  test('text stats', () => {
    const bytes = (s: string) => new TextEncoder().encode(s)
    expect(textStats(bytes(''))).toEqual({ lines: 0, binary: false })
    expect(textStats(bytes('a\nb\n'))).toEqual({ lines: 2, binary: false })
    expect(textStats(bytes('a\nb'))).toEqual({ lines: 2, binary: false })
    expect(textStats(new Uint8Array([97, 0, 98]))).toEqual({ lines: 0, binary: true })
  })
})

describe('ChangesService on a real repository', () => {
  const home = useTempHome()
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    })
  const sessionAt = (cwd: string) =>
    ({ get: (id: string) => (id === 's' ? ({ id: 's', cwd } as SessionRecord) : undefined) }) as const

  async function repo() {
    const root = join(home.dir(), 'app')
    await mkdir(join(root, 'src'), { recursive: true })
    git(root, 'init', '-q', '-b', 'main')
    await writeFile(join(root, '.gitignore'), 'node_modules/\n')
    await writeFile(join(root, 'src', 'a.ts'), 'one\ntwo\nthree\n')
    await writeFile(join(root, 'old.ts'), 'export const x = 1\nexport const y = 2\nexport const z = 3\n')
    await writeFile(join(root, 'gone.ts'), 'bye\n')
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
    git(root, 'add', '-A')
    git(root, 'commit', '-q', '-m', 'init')
    return root
  }

  test('lists modified, renamed, deleted, untracked and binary files with counts', async () => {
    const root = await repo()
    await writeFile(join(root, 'src', 'a.ts'), 'one\n2\nthree\nfour\nfive\n')
    await rename(join(root, 'old.ts'), join(root, 'new.ts'))
    git(root, 'add', '-A', 'old.ts', 'new.ts')
    await rm(join(root, 'gone.ts'))
    await writeFile(join(root, 'notes.md'), 'a\nb\nc\nd\n')
    await writeFile(join(root, 'img.bin'), Buffer.from([1, 0, 2, 3]))
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\npackages: {}\n')
    await mkdir(join(root, 'node_modules'))
    await writeFile(join(root, 'node_modules', 'ignored.js'), 'x\n')

    const service = new ChangesService(new GitClient(execaExecutor), sessionAt(join(root, 'src')))
    const result = await service.list('s')
    expect(result.root?.endsWith('app')).toBe(true)
    expect(result.branch).toBe('main')
    const byPath = Object.fromEntries(result.files.map((f) => [f.path, f]))
    expect(Object.keys(byPath).sort()).toEqual([
      'gone.ts',
      'img.bin',
      'new.ts',
      'notes.md',
      'pnpm-lock.yaml',
      'src/a.ts',
    ])
    expect(byPath['src/a.ts']).toMatchObject({ status: 'modified', added: 3, deleted: 1, generated: false })
    expect(byPath['new.ts']).toMatchObject({ status: 'renamed', oldPath: 'old.ts', added: 0, deleted: 0 })
    expect(byPath['gone.ts']).toMatchObject({ status: 'deleted', added: 0, deleted: 1 })
    expect(byPath['notes.md']).toMatchObject({ status: 'added', untracked: true, added: 4, deleted: 0 })
    expect(byPath['img.bin']).toMatchObject({ status: 'added', untracked: true, binary: true, added: null })
    expect(byPath['pnpm-lock.yaml']).toMatchObject({ status: 'modified', generated: true })

    const diff = await service.diff('s', 'src/a.ts')
    expect(diff.binary).toBe(false)
    expect(diff.lines).toContain('+2')
    expect(diff.lines).toContain('-two')
    expect(diff.total).toBe(diff.lines.length)
    const untracked = await service.diff('s', 'notes.md')
    expect(untracked.lines.filter((l) => l.startsWith('+') && !l.startsWith('+++'))).toEqual([
      '+a',
      '+b',
      '+c',
      '+d',
    ])
    const renamed = await service.diff('s', 'new.ts')
    expect(renamed.lines.some((l) => l.startsWith('rename from old.ts'))).toBe(true)
    expect(await service.diff('s', 'img.bin')).toMatchObject({ binary: true, lines: [] })
    await expect(service.diff('s', '../../etc/passwd')).rejects.toMatchObject({ code: 'not_found' })
    await expect(service.list('missing')).rejects.toMatchObject({ code: 'not_found' })
  })

  test('pages a long diff', async () => {
    const root = await repo()
    const lines = Array.from({ length: CHANGES_DIFF_PAGE + 500 }, (_, i) => `line ${i}`).join('\n')
    await writeFile(join(root, 'big.txt'), `${lines}\n`)
    const service = new ChangesService(new GitClient(execaExecutor), sessionAt(root))
    const first = await service.diff('s', 'big.txt')
    expect(first.lines).toHaveLength(CHANGES_DIFF_PAGE)
    expect(first.total).toBeGreaterThan(CHANGES_DIFF_PAGE + 500)
    const rest = await service.diff('s', 'big.txt', CHANGES_DIFF_PAGE)
    expect(rest.offset).toBe(CHANGES_DIFF_PAGE)
    expect(rest.lines).toHaveLength(first.total - CHANGES_DIFF_PAGE)
    expect(rest.lines.at(-1)).toBe(`+line ${CHANGES_DIFF_PAGE + 499}`)
  })

  test('a repository without commits diffs against the empty tree; outside git there is nothing', async () => {
    const root = join(home.dir(), 'fresh')
    await mkdir(root)
    git(root, 'init', '-q', '-b', 'main')
    await writeFile(join(root, 'a.txt'), 'x\n')
    git(root, 'add', 'a.txt')
    const client = new GitClient(execaExecutor)
    expect((await client.changes(root))?.base).toBe(EMPTY_TREE)
    expect((await new ChangesService(client, sessionAt(root)).list('s')).files).toMatchObject([
      { path: 'a.txt', status: 'added', added: 1, untracked: false },
    ])
    const outside = join(home.dir(), 'plain')
    await mkdir(outside)
    expect(await new ChangesService(client, sessionAt(outside)).list('s')).toEqual({
      root: null,
      branch: null,
      files: [],
      remote: null,
      defaultBranch: null,
      unpushed: 0,
      gh: false,
    })
  })
})
