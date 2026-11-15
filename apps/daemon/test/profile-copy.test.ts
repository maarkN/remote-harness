import { lstat, mkdir, readdir, readFile, readlink, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadCommands } from '../src/features/autocomplete/commands.ts'
import { BACKUP_SUFFIX } from '../src/features/hooks/installer.ts'
import {
  COPY_ITEMS,
  type CopyChoice,
  copyMainProfile,
  mergeMcpServers,
  mergeSettings,
} from '../src/features/setup/profile-copy.ts'
import { useTempHome } from './helpers.ts'

const home = useTempHome()

async function write(path: string, content: string) {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content)
}

const json = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
const all: CopyChoice = { items: new Set(COPY_ITEMS), link: false }

const OUR_HOOK = {
  type: 'command',
  command:
    "curl -s -m 5 -o /dev/null -X POST -H 'content-type: application/json' --config '/h/.remote-harness/hook-secret.curlrc' --data-binary @- 'http://127.0.0.1:7338/hooks/Stop' >/dev/null 2>&1 || true",
}

/** A main profile like `~/.claude` with every item, the login, history and per-project state. */
async function mainProfile() {
  const h = home.dir()
  const dir = join(h, '.claude')
  const mainJson = join(h, '.claude.json')
  await write(
    join(dir, 'settings.json'),
    JSON.stringify({
      model: 'sonnet',
      theme: 'dark',
      enabledPlugins: { 'figma@official': true },
      hooks: { Stop: [{ hooks: [OUR_HOOK] }, { hooks: [{ type: 'command', command: 'say done' }] }] },
    }),
  )
  await write(join(dir, 'CLAUDE.md'), '# Me\n')
  await write(join(dir, 'skills/review/SKILL.md'), '---\nname: review\ndescription: Reviews\n---\n')
  await write(join(h, 'store/linked/SKILL.md'), '---\nname: linked\n---\n')
  await symlink(join(h, 'store/linked'), join(dir, 'skills/linked'))
  // Skill managers link skills in with relative targets (`../../.agents/skills/x`).
  await write(join(h, '.agents/skills/relative/SKILL.md'), '---\nname: relative\n---\n')
  await symlink('../../.agents/skills/relative', join(dir, 'skills/relative'))
  await write(join(dir, 'commands/fix.md'), '---\ndescription: Fix\n---\n')
  await write(join(dir, 'agents/tester.md'), '---\nname: tester\n---\n')
  await write(join(dir, 'plugins/installed_plugins.json'), '{"version":2,"plugins":{}}')
  await write(join(dir, 'plugins/known_marketplaces.json'), '{}')
  await write(join(dir, 'plugins/cache/big/file'), 'x')
  await write(join(dir, '.credentials.json'), '{"secret":true}')
  await write(join(dir, 'history.jsonl'), '{}\n')
  await write(join(dir, 'projects/-p/s.jsonl'), '{}\n')
  await write(
    mainJson,
    JSON.stringify({
      oauthAccount: { emailAddress: 'me@example.com' },
      projects: { '/p': { allowedTools: [] } },
      mcpServers: { github: { command: 'gh-mcp' }, linear: { url: 'https://mcp.linear.app' } },
    }),
  )
  // Deeper than the main profile, so a relative link copied as is would point nowhere.
  return { main: { dir, json: mainJson }, target: join(h, 'profiles', '.claude-work') }
}

describe('merges', () => {
  test('settings: the new profile wins, our hooks and status line wrapper are left out', () => {
    const merged = mergeSettings(
      { model: 'opus' },
      {
        model: 'sonnet',
        theme: 'dark',
        hooks: { Stop: [{ hooks: [OUR_HOOK] }] },
        statusLine: { type: 'command', command: "'/h/.remote-harness/bin/remote-harness-statusline'" },
      },
    )
    expect(merged.model).toBe('opus')
    expect(merged.theme).toBe('dark')
    expect(merged.hooks).toBeUndefined()
  })

  test('MCP servers by name, existing ones kept; nothing new → same object', () => {
    const target = { oauthAccount: { a: 1 }, mcpServers: { github: { command: 'mine' } } }
    expect(mergeMcpServers(target, { github: { command: 'theirs' }, linear: { url: 'u' } })).toEqual({
      oauthAccount: { a: 1 },
      mcpServers: { github: { command: 'mine' }, linear: { url: 'u' } },
    })
    expect(mergeMcpServers(target, { github: { command: 'theirs' } })).toBe(target)
  })
})

describe('copyMainProfile', () => {
  test('brings every item and never the login, credentials, history or projects', async () => {
    const { main, target } = await mainProfile()
    const outcomes = await copyMainProfile(main, target, all)
    expect(outcomes.map((o) => `${o.item}:${o.status}`)).toEqual([
      'settings:copied',
      'memory:copied',
      'skills:copied',
      'commands:copied',
      'agents:copied',
      'plugins:copied',
      'mcp:copied',
    ])
    const settings = await json(join(target, 'settings.json'))
    expect(settings).toMatchObject({
      model: 'sonnet',
      theme: 'dark',
      enabledPlugins: { 'figma@official': true },
    })
    expect(settings.hooks).toEqual({ Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] })
    expect(await readFile(join(target, 'CLAUDE.md'), 'utf8')).toBe('# Me\n')
    expect((await lstat(join(target, 'skills/linked'))).isSymbolicLink()).toBe(true)
    expect(await readFile(join(target, 'commands/fix.md'), 'utf8')).toContain('Fix')
    expect(await readdir(join(target, 'plugins'))).toEqual([
      'installed_plugins.json',
      'known_marketplaces.json',
    ])
    expect(await json(join(target, '.claude.json'))).toEqual({
      mcpServers: { github: { command: 'gh-mcp' }, linear: { url: 'https://mcp.linear.app' } },
    })
    expect((await stat(join(target, '.claude.json'))).mode & 0o777).toBe(0o600)
    const names = await readdir(target)
    for (const name of ['.credentials.json', 'history.jsonl', 'projects']) expect(names).not.toContain(name)
    // The session's / list reads the copied skills from the new profile.
    const listed = (await loadCommands(target, join(home.dir(), 'proj')))
      .filter((c) => c.source === 'profile')
      .map((c) => c.name)
    expect(listed).toEqual(expect.arrayContaining(['review', 'linked', 'relative', 'fix']))
  })

  test('links skills, commands and agents instead of copying them', async () => {
    const { main, target } = await mainProfile()
    const outcomes = await copyMainProfile(main, target, { items: new Set(COPY_ITEMS), link: true })
    expect(outcomes.filter((o) => o.status === 'linked').map((o) => o.item)).toEqual([
      'skills',
      'commands',
      'agents',
    ])
    expect(await readlink(join(target, 'skills'))).toBe(join(main.dir, 'skills'))
    // A skill added to the main profile later shows in the new one.
    await write(join(main.dir, 'skills/later/SKILL.md'), '---\nname: later\n---\n')
    expect((await loadCommands(target, join(home.dir(), 'proj'))).some((c) => c.name === 'later')).toBe(true)
  })

  test('keeps what the new profile has, with a backup of a merged file', async () => {
    const { main, target } = await mainProfile()
    await write(join(target, 'settings.json'), JSON.stringify({ model: 'opus' }))
    await write(join(target, '.claude.json'), JSON.stringify({ mcpServers: { github: { command: 'mine' } } }))
    await write(join(target, 'CLAUDE.md'), '# Work\n')
    await write(join(target, 'skills/review/SKILL.md'), '---\nname: review\ndescription: Mine\n---\n')
    const outcomes = await copyMainProfile(main, target, all)
    expect(Object.fromEntries(outcomes.map((o) => [o.item, o.status]))).toMatchObject({
      settings: 'merged',
      memory: 'kept',
      skills: 'merged',
      mcp: 'merged',
    })
    expect(await json(join(target, 'settings.json'))).toMatchObject({ model: 'opus', theme: 'dark' })
    expect(await json(join(target, `settings.json${BACKUP_SUFFIX}`))).toEqual({ model: 'opus' })
    expect(await readFile(join(target, 'CLAUDE.md'), 'utf8')).toBe('# Work\n')
    expect(await readFile(join(target, 'skills/review/SKILL.md'), 'utf8')).toContain('Mine')
    expect((await lstat(join(target, 'skills/linked'))).isSymbolicLink()).toBe(true)
    expect((await json(join(target, '.claude.json'))).mcpServers).toEqual({
      github: { command: 'mine' },
      linear: { url: 'https://mcp.linear.app' },
    })
  })

  test('a second run changes nothing', async () => {
    const { main, target } = await mainProfile()
    await copyMainProfile(main, target, all)
    const before = await stat(join(target, 'settings.json'))
    const outcomes = await copyMainProfile(main, target, all)
    expect(outcomes.every((o) => o.status === 'kept')).toBe(true)
    expect((await stat(join(target, 'settings.json'))).mtimeMs).toBe(before.mtimeMs)
    const linked = { items: new Set(COPY_ITEMS), link: true }
    const other = join(home.dir(), '.claude-other')
    await copyMainProfile(main, other, linked)
    expect((await copyMainProfile(main, other, linked)).every((o) => o.status === 'kept')).toBe(true)
  })

  test('nothing chosen writes nothing; a missing item is reported', async () => {
    const { main, target } = await mainProfile()
    expect(await copyMainProfile(main, target, { items: new Set(), link: true })).toEqual([])
    expect(await readdir(home.dir())).not.toContain('profiles')
    const bare = { dir: join(home.dir(), 'empty'), json: join(home.dir(), 'none.json') }
    const outcomes = await copyMainProfile(bare, target, all)
    expect(outcomes.every((o) => o.status === 'missing')).toBe(true)
  })
})
