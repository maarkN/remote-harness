import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CommandItem } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import {
  CODEX_COMMANDS,
  codexCommandsSignature,
  loadCodexCommands,
} from '../src/features/autocomplete/codex-commands.ts'
import { tomlString } from '../src/features/autocomplete/command-files.ts'
import { GEMINI_COMMANDS, loadGeminiCommands } from '../src/features/autocomplete/gemini-commands.ts'
import { kimiCommandsSignature, loadKimiCommands } from '../src/features/autocomplete/kimi-commands.ts'
import { loadQwenCommands, qwenCommandsSignature } from '../src/features/autocomplete/qwen-commands.ts'
import { useTempHome } from './helpers.ts'

const home = useTempHome()

async function write(path: string, content = '') {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content)
}

const skill = (name: string, description = '', extra = '') =>
  `---\nname: ${name}\ndescription: ${description}\n${extra}---\nBody\n`

function byKey(items: readonly CommandItem[]): Record<string, CommandItem> {
  return Object.fromEntries(items.map((i) => [`${i.prefix}${i.name}`, i]))
}

const tick = () => new Promise((r) => setTimeout(r, 20))

describe('TOML strings', () => {
  test('reads basic, literal and multi-line values', () => {
    const text = [
      'description = "Write the \\"commit\\""',
      "title = 'C:\\path'",
      'prompt = """',
      'First line',
      'second"""',
    ].join('\n')
    expect(tomlString(text, 'description')).toBe('Write the "commit"')
    expect(tomlString(text, 'title')).toBe('C:\\path')
    expect(tomlString(text, 'prompt')).toBe('First line\nsecond')
    expect(tomlString(text, 'missing')).toBeNull()
    expect(tomlString('description = 42', 'description')).toBeNull()
  })
})

describe('Codex', () => {
  test('profile, agents, repository and bundled skills, all run as $name', async () => {
    const h = home.dir()
    const cfg = join(h, '.codex')
    const repo = join(h, 'work/repo')
    const cwd = join(repo, 'apps/web')
    await mkdir(join(repo, '.git'), { recursive: true })
    await write(join(cfg, 'skills/hatch-pet/SKILL.md'), skill('hatch-pet', 'Hatch a pet'))
    await write(join(cfg, 'skills/.system/skill-creator/SKILL.md'), skill('skill-creator', 'Create skills'))
    await write(join(h, '.agents/skills/notes/SKILL.md'), skill('notes'))
    await write(join(repo, '.agents/skills/release/SKILL.md'), skill('release', 'Ship it'))
    await write(join(cwd, '.codex/skills/web-only/SKILL.md'), skill('web-only'))
    await write(join(h, '.agents/skills/release/SKILL.md'), skill('release', 'Personal copy'))
    // Above the repository root: not read.
    await write(join(h, 'work/.agents/skills/far/SKILL.md'), skill('far'))

    const items = byKey(await loadCodexCommands(cfg, cwd, h))
    expect(items['$hatch-pet']).toMatchObject({ source: 'profile', description: 'Hatch a pet' })
    expect(items.$notes).toMatchObject({ source: 'profile' })
    expect(items.$release).toMatchObject({ source: 'project', description: 'Ship it' })
    expect(items['$web-only']).toMatchObject({ source: 'project' })
    expect(items['$skill-creator']).toMatchObject({ source: 'builtin' })
    expect(items.$far).toBeUndefined()
    expect(items['/model']).toMatchObject({ source: 'builtin', interactive: true })
    expect(Object.keys(items).filter((k) => k.startsWith('/')).length).toBe(CODEX_COMMANDS.length)
  })

  test('outside a repository only the session folder is read', async () => {
    const h = home.dir()
    const cwd = join(h, 'plain/sub')
    await write(join(h, 'plain/.agents/skills/parent/SKILL.md'), skill('parent'))
    await write(join(cwd, '.agents/skills/here/SKILL.md'), skill('here'))
    const items = byKey(await loadCodexCommands(join(h, '.codex'), cwd, h))
    expect(items.$here).toMatchObject({ source: 'project' })
    expect(items.$parent).toBeUndefined()
  })

  test('follows a symlinked skill folder', async () => {
    const h = home.dir()
    await write(join(h, 'store/linked/SKILL.md'), skill('linked'))
    await mkdir(join(h, '.codex/skills'), { recursive: true })
    await symlink(join(h, 'store/linked'), join(h, '.codex/skills/linked'))
    const items = byKey(await loadCodexCommands(join(h, '.codex'), h, h))
    expect(items.$linked).toMatchObject({ source: 'profile' })
  })

  test('signature changes when a skill is added', async () => {
    const h = home.dir()
    const cfg = join(h, '.codex')
    await mkdir(join(cfg, 'skills'), { recursive: true })
    await mkdir(join(h, '.agents/skills'), { recursive: true })
    const before = await codexCommandsSignature(cfg, h, h)
    await tick()
    await write(join(h, '.agents/skills/new/SKILL.md'), skill('new'))
    expect(await codexCommandsSignature(cfg, h, h)).not.toBe(before)
  })
})

describe('Gemini CLI', () => {
  test('TOML commands of the profile and the project, named by path; skills left out', async () => {
    const h = home.dir()
    const cfg = join(h, '.gemini')
    const cwd = join(h, 'proj')
    await write(join(cfg, 'commands/test.toml'), 'prompt = """\nRun the tests\nand report\n"""\n')
    await write(join(cfg, 'commands/review.toml'), 'description = "Personal review"\nprompt = "x"\n')
    await write(join(cfg, 'skills/pdf/SKILL.md'), skill('pdf'))
    await write(join(cwd, '.gemini/commands/git/commit.toml'), 'description = "Write the commit"\n')
    await write(join(cwd, '.gemini/commands/review.toml'), 'description = "Project review"\n')
    await write(join(cwd, '.gemini/commands/notes.md'), 'not a command\n')

    const items = byKey(await loadGeminiCommands(cfg, cwd))
    expect(items['/test']).toMatchObject({ source: 'profile', description: 'Run the tests' })
    expect(items['/git:commit']).toMatchObject({ source: 'project', description: 'Write the commit' })
    expect(items['/review']).toMatchObject({ source: 'project', description: 'Project review' })
    expect(items['/pdf']).toBeUndefined()
    expect(items['/notes']).toBeUndefined()
    expect(Object.values(items).filter((i) => i.source === 'builtin').length).toBe(GEMINI_COMMANDS.length)
  })
})

describe('Kimi CLI', () => {
  test('brand and generic skill folders, Kimi first, project root by .git, flow skills twice', async () => {
    const h = home.dir()
    const repo = join(h, 'repo')
    const cwd = join(repo, 'pkg')
    await mkdir(join(repo, '.git'), { recursive: true })
    await write(join(h, '.kimi/skills/review/SKILL.md'), skill('review', 'Kimi review'))
    await write(join(h, '.claude/skills/review/SKILL.md'), skill('review', 'Claude review'))
    await write(join(h, '.claude/skills/claude-only/SKILL.md'), skill('claude-only'))
    await write(join(h, '.codex/skills/codex-only/SKILL.md'), skill('codex-only'))
    await write(join(h, '.config/agents/skills/generic/SKILL.md'), skill('generic'))
    // The generic group stops at its first existing folder.
    await write(join(h, '.agents/skills/shadowed/SKILL.md'), skill('shadowed'))
    await write(
      join(repo, '.agents/skills/code-review/SKILL.md'),
      skill('code-review', 'Flow', 'type: flow\n'),
    )
    await write(join(repo, '.kimi/skills/deploy/SKILL.md'), skill('deploy'))

    const items = byKey(await loadKimiCommands(join(h, 'share'), cwd, h))
    expect(items['/skill:review']).toMatchObject({ source: 'profile', description: 'Kimi review' })
    expect(items['/skill:claude-only']).toMatchObject({ source: 'profile' })
    expect(items['/skill:codex-only']).toMatchObject({ source: 'profile' })
    expect(items['/skill:generic']).toMatchObject({ source: 'profile' })
    expect(items['/skill:shadowed']).toBeUndefined()
    expect(items['/skill:deploy']).toMatchObject({ source: 'project' })
    expect(items['/skill:code-review']).toMatchObject({ source: 'project' })
    expect(items['/flow:code-review']).toMatchObject({ source: 'project' })
    expect(items['/flow:review']).toBeUndefined()
  })

  test('~/.agents/skills when ~/.config/agents/skills does not exist', async () => {
    const h = home.dir()
    await write(join(h, '.agents/skills/generic/SKILL.md'), skill('generic'))
    const items = byKey(await loadKimiCommands(join(h, '.kimi'), h, h))
    expect(items['/skill:generic']).toMatchObject({ source: 'profile' })
  })

  test('signature changes when a skill is added', async () => {
    const h = home.dir()
    await mkdir(join(h, '.kimi/skills'), { recursive: true })
    const before = await kimiCommandsSignature(join(h, '.kimi'), h, h)
    await tick()
    await write(join(h, '.kimi/skills/new/SKILL.md'), skill('new'))
    expect(await kimiCommandsSignature(join(h, '.kimi'), h, h)).not.toBe(before)
  })
})

describe('Qwen Code', () => {
  test('Markdown and TOML commands, one-level skills, project first', async () => {
    const h = home.dir()
    const cfg = join(h, '.qwen')
    const cwd = join(h, 'proj')
    await write(join(cfg, 'commands/test.md'), '---\ndescription: Run the tests\n---\nbody\n')
    await write(join(cfg, 'commands/old.toml'), 'description = "Older format"\n')
    await write(join(cfg, 'commands/review.md'), '---\ndescription: Personal review\n---\n')
    await write(join(cfg, 'skills/pdf/SKILL.md'), skill('pdf', 'PDF tools'))
    await write(join(cfg, 'skills/group/nested/SKILL.md'), skill('nested'))
    await write(join(h, '.agents/skills/notes/SKILL.md'), skill('notes'))
    await write(join(cwd, '.qwen/commands/git/commit.md'), 'Write the commit\n')
    await write(join(cwd, '.qwen/commands/review.md'), '---\ndescription: Project review\n---\n')
    await write(join(cwd, '.agents/skills/release/SKILL.md'), skill('release'))

    const items = byKey(await loadQwenCommands(cfg, cwd, h))
    expect(items['/test']).toMatchObject({ source: 'profile', description: 'Run the tests' })
    expect(items['/old']).toMatchObject({ source: 'profile', description: 'Older format' })
    expect(items['/pdf']).toMatchObject({ source: 'profile', description: 'PDF tools' })
    expect(items['/nested']).toBeUndefined()
    expect(items['/notes']).toMatchObject({ source: 'profile' })
    expect(items['/git:commit']).toMatchObject({ source: 'project', description: 'Write the commit' })
    expect(items['/review']).toMatchObject({ source: 'project', description: 'Project review' })
    expect(items['/release']).toMatchObject({ source: 'project' })
  })

  test('signature changes when a command is added', async () => {
    const h = home.dir()
    const cfg = join(h, '.qwen')
    await mkdir(join(cfg, 'commands'), { recursive: true })
    const before = await qwenCommandsSignature(cfg, h, h)
    await tick()
    await write(join(cfg, 'commands/new.md'), 'New\n')
    expect(await qwenCommandsSignature(cfg, h, h)).not.toBe(before)
  })
})
