import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Profile, SessionState } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { actionAllowed, ChangeActions, commitPathsOf } from '../src/features/changes/actions.ts'
import {
  clipInput,
  GENERATE_INPUT_MAX,
  MessageWriter,
  splitMessage,
} from '../src/features/changes/generate.ts'
import { ChangesService } from '../src/features/changes/service.ts'
import type { SessionRecord } from '../src/features/sessions/types.ts'
import { execaExecutor } from '../src/infra/exec.ts'
import { GitClient, githubCompareUrl, stripCredentials } from '../src/infra/git.ts'
import { GitHubCli, prUrlOf } from '../src/infra/github.ts'
import { fakeExecutor, useTempHome } from './helpers.ts'

describe('pure helpers', () => {
  test('the gate refuses only a running session without force', () => {
    const states: SessionState[] = ['running', 'waiting', 'idle', 'ended']
    expect(states.map((s) => actionAllowed(s, false))).toEqual([false, true, true, true])
    expect(actionAllowed('running', true)).toBe(true)
  })

  test('commit paths take renames along and refuse unknown paths', () => {
    const files = [
      { path: 'a.ts', oldPath: null },
      { path: 'new.ts', oldPath: 'old.ts' },
    ]
    expect(commitPathsOf(['new.ts', 'a.ts', 'a.ts'], files)).toEqual(['new.ts', 'old.ts', 'a.ts'])
    expect(commitPathsOf(['../etc/passwd'], files)).toBeNull()
  })

  test('remotes lose their credentials; GitHub remotes get a compare URL', () => {
    expect(stripCredentials('https://user:token@github.com/acme/app.git')).toBe(
      'https://github.com/acme/app.git',
    )
    expect(stripCredentials('git@github.com:acme/app.git')).toBe('git@github.com:acme/app.git')
    expect(githubCompareUrl('git@github.com:acme/app.git', 'fix-a')).toBe(
      'https://github.com/acme/app/compare/fix-a?expand=1',
    )
    expect(githubCompareUrl('https://x:y@github.com/acme/app', 'feat/369-x')).toBe(
      'https://github.com/acme/app/compare/feat/369-x?expand=1',
    )
    expect(githubCompareUrl('ssh://git@github.com/acme/app.git', 'b')).toBe(
      'https://github.com/acme/app/compare/b?expand=1',
    )
    expect(githubCompareUrl('https://gitlab.com/acme/app.git', 'b')).toBeNull()
    expect(githubCompareUrl('/tmp/bare.git', 'b')).toBeNull()
  })

  test('generated replies and inputs', () => {
    expect(splitMessage('"Fix login redirect"\n\nThe callback lost the path.\n')).toEqual({
      title: 'Fix login redirect',
      body: 'The callback lost the path.',
    })
    expect(splitMessage('\n# Title: Add rules screen\n- one')).toEqual({
      title: 'Add rules screen',
      body: '- one',
    })
    const long = `${'x'.repeat(10)}\n`.repeat(GENERATE_INPUT_MAX)
    const clipped = clipInput(long)
    expect(clipped.length).toBeLessThanOrEqual(GENERATE_INPUT_MAX + 5)
    expect(clipped.endsWith('[…]\n')).toBe(true)
    expect(clipInput('short')).toBe('short')
  })

  test('gh prints the PR URL last', async () => {
    expect(prUrlOf('Creating pull request…\n\nhttps://github.com/acme/app/pull/7\n')).toBe(
      'https://github.com/acme/app/pull/7',
    )
    const exec = fakeExecutor((call) =>
      call.file === 'gh' ? { stdout: 'https://github.com/acme/app/pull/7\n' } : undefined,
    )
    const gh = new GitHubCli(exec)
    expect(await gh.available()).toBe(true)
    expect(await gh.createPr('/w', { title: 'T', body: 'B', head: 'fix-a', base: 'main' })).toBe(
      'https://github.com/acme/app/pull/7',
    )
    expect(exec.calls.at(-1)).toMatchObject({
      file: 'gh',
      args: ['pr', 'create', '--title', 'T', '--body', 'B', '--head', 'fix-a', '--base', 'main'],
      options: { cwd: '/w' },
    })
    const failing = new GitHubCli(fakeExecutor(() => ({ exitCode: 1, stderr: 'not logged in' })))
    expect(await failing.available()).toBe(false)
    await expect(failing.createPr('/w', { title: 'T', body: '', head: 'b', base: null })).rejects.toThrow(
      'not logged in',
    )
  })
})

describe('commit, push and PR on a real repository', () => {
  const home = useTempHome()
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
  }
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env })

  async function setup(state: SessionState = 'idle') {
    // The daemon's own git calls need an identity too.
    Object.assign(process.env, {
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    })
    const bare = join(home.dir(), 'remote.git')
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare])
    const root = join(home.dir(), 'app')
    await mkdir(root)
    git(root, 'init', '-q', '-b', 'main')
    await writeFile(join(root, 'a.ts'), 'a\n')
    await writeFile(join(root, 'b.ts'), 'b\n')
    git(root, 'add', '-A')
    git(root, 'commit', '-q', '-m', 'init')
    git(root, 'remote', 'add', 'origin', bare)
    git(root, 'push', '-q', '-u', 'origin', 'main')
    git(root, 'remote', 'set-head', 'origin', 'main')
    const session = { id: 's', cwd: root, state, profileId: 'p' } as SessionRecord
    const sessions = { get: (id: string) => (id === 's' ? session : undefined) }
    const client = new GitClient(execaExecutor)
    const service = new ChangesService(client, sessions)
    const prs: unknown[] = []
    const gh = {
      available: async () => true,
      createPr: async (_root: string, pr: unknown) => {
        prs.push(pr)
        return 'https://github.com/acme/app/pull/1'
      },
    }
    return { root, session, service, client, actions: new ChangeActions(service, client, gh), prs, bare }
  }

  test('commits only the selected files, leaving what the agent staged staged', async () => {
    const { root, actions, service } = await setup()
    await writeFile(join(root, 'a.ts'), 'a2\n')
    await writeFile(join(root, 'b.ts'), 'b2\n')
    git(root, 'add', 'b.ts')
    await writeFile(join(root, 'c.ts'), 'new\n')
    const { commit, branch } = await actions.commit('s', {
      paths: ['a.ts', 'c.ts'],
      message: '  feat: a and c  ',
    })
    expect(branch).toBe('main')
    expect(git(root, 'rev-parse', '--short', 'HEAD').trim()).toBe(commit)
    expect(git(root, 'show', '--name-only', '--format=%s', 'HEAD').trim().split('\n')).toEqual([
      'feat: a and c',
      '',
      'a.ts',
      'c.ts',
    ])
    expect(git(root, 'diff', '--cached', '--name-only').trim()).toBe('b.ts')
    const list = await service.list('s')
    expect(list).toMatchObject({ defaultBranch: 'main', unpushed: 1, remote: join(home.dir(), 'remote.git') })
    await expect(actions.commit('s', { paths: ['nope.ts'], message: 'x' })).rejects.toMatchObject({
      code: 'bad_request',
    })
  })

  test('creates a branch first, then pushes and opens the PR against the default branch', async () => {
    const { root, actions, prs, bare } = await setup()
    await writeFile(join(root, 'a.ts'), 'a2\n')
    await expect(
      actions.commit('s', { paths: ['a.ts'], message: 'x', newBranch: 'bad..name' }),
    ).rejects.toMatchObject({ code: 'bad_request' })
    await expect(
      actions.commit('s', { paths: ['a.ts'], message: 'x', newBranch: 'main' }),
    ).rejects.toMatchObject({
      code: 'bad_request',
    })
    expect(
      await actions.commit('s', { paths: ['a.ts'], message: 'fix: a', newBranch: 'fix-a' }),
    ).toMatchObject({
      branch: 'fix-a',
    })
    expect(git(root, 'branch', '--show-current').trim()).toBe('fix-a')
    expect(git(root, 'log', '-1', '--format=%s', 'main').trim()).toBe('init')
    expect(await actions.push('s')).toEqual({ branch: 'fix-a', compareUrl: null })
    expect(git(bare, 'log', '-1', '--format=%s', 'fix-a').trim()).toBe('fix: a')
    expect(await actions.pr('s', { title: ' Fix a ', body: 'Body' })).toEqual({
      url: 'https://github.com/acme/app/pull/1',
    })
    expect(prs).toEqual([{ title: 'Fix a', body: 'Body', head: 'fix-a', base: 'main' }])
  })

  test('refused while the agent works, unless forced', async () => {
    const { root, actions } = await setup('running')
    await writeFile(join(root, 'a.ts'), 'a2\n')
    await expect(actions.commit('s', { paths: ['a.ts'], message: 'x' })).rejects.toMatchObject({
      code: 'session_busy',
    })
    await expect(actions.push('s')).rejects.toMatchObject({ code: 'session_busy' })
    await expect(actions.pr('s', { title: 't', body: '' })).rejects.toMatchObject({ code: 'session_busy' })
    expect(await actions.commit('s', { paths: ['a.ts'], message: 'x', force: true })).toMatchObject({
      branch: 'main',
    })
  })

  test('writes a commit message from the selected diff through the agent CLI', async () => {
    const { root, service, client } = await setup()
    await writeFile(join(root, 'a.ts'), 'a2\n')
    await writeFile(join(root, 'b.ts'), 'b-secret\n')
    const agent = fakeExecutor(() => ({
      stdout: JSON.stringify({ result: 'Update a\n\nBecause a changed.' }),
    }))
    const profiles: Profile[] = [{ id: 'p', name: 'P', configDir: join(home.dir(), '.claude'), color: '' }]
    const writer = new MessageWriter(service, client, agent, profiles)
    expect(await writer.generate('s', 'commit', ['a.ts'])).toEqual({
      title: 'Update a',
      body: 'Because a changed.',
    })
    const call = agent.calls[0]
    expect(call?.file).toBe('claude')
    expect(call?.args).toContain('--allowedTools')
    expect(call?.options?.input).toContain('+a2')
    expect(call?.options?.input).toContain('init')
    expect(call?.options?.input).not.toContain('b-secret')
    expect(await writer.generate('s', 'pr')).toMatchObject({ title: 'Update a' })
    expect(agent.calls[1]?.options?.input).toContain('Commits:')

    const provider = new MessageWriter(service, client, agent, [
      { ...profiles[0]!, provider: { kind: 'openrouter' } },
    ])
    await expect(provider.generate('s', 'commit')).rejects.toMatchObject({ code: 'not_found' })
    const silent = new MessageWriter(
      service,
      client,
      fakeExecutor(() => ({ exitCode: 1 })),
      profiles,
    )
    await expect(silent.generate('s', 'commit')).rejects.toMatchObject({ code: 'internal' })
  })

  test('a Codex session writes it through codex exec', async () => {
    const { root, service, client } = await setup()
    await writeFile(join(root, 'a.ts'), 'a2\n')
    const message = { type: 'item.completed', item: { type: 'agent_message', text: 'Update a' } }
    const agent = fakeExecutor(() => ({ stdout: JSON.stringify(message) }))
    const profiles: Profile[] = [
      { id: 'p', name: 'P', configDir: join(home.dir(), '.codex'), color: '', agent: 'codex' },
    ]
    const writer = new MessageWriter(service, client, agent, profiles)
    expect(await writer.generate('s', 'commit', ['a.ts'])).toMatchObject({ title: 'Update a' })
    expect(agent.calls[0]?.file).toBe('codex')
    expect(agent.calls[0]?.args[0]).toBe('exec')
    expect(agent.calls[0]?.options?.input).toContain('+a2')
  })
})
