import type { Dirent } from 'node:fs'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import type { CommandItem, CommandSource } from '@remote-harness/protocol'
import { parse as parseYaml } from 'yaml'
import { BUILTIN_COMMANDS } from './builtin-commands.ts'

type Frontmatter = { name?: unknown; description?: unknown }

export function parseFrontmatter(text: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!match?.[1]) return {}
  try {
    const data = parseYaml(match[1]) as unknown
    return data && typeof data === 'object' ? (data as Frontmatter) : {}
  } catch {
    return {}
  }
}

function firstLine(text: string): string {
  const body = text.replace(/^---[\s\S]*?---\s*/, '')
  return (
    body
      .split('\n')
      .find((l) => l.trim() && !l.startsWith('#'))
      ?.trim()
      .slice(0, 120) ?? ''
  )
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * The entries of `dir` as directories and files, following symlinks: skill managers link skill
 * folders into `skills/`, and Claude Code reads them (#538). Broken links are left out. A directory
 * already walked (through a link loop, or two links to one folder) is skipped via `visited`.
 */
async function listEntries(dir: string, visited: Set<string>): Promise<{ dirs: string[]; files: string[] }> {
  const empty = { dirs: [], files: [] }
  try {
    const real = await realpath(dir)
    if (visited.has(real)) return empty
    visited.add(real)
  } catch {
    return empty
  }
  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return empty
  }
  const dirs: string[] = []
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    let isDir = entry.isDirectory()
    let isFile = entry.isFile()
    if (entry.isSymbolicLink()) {
      const target = await stat(path).catch(() => null)
      isDir = target?.isDirectory() ?? false
      isFile = target?.isFile() ?? false
    }
    if (isDir) dirs.push(path)
    else if (isFile) files.push(path)
  }
  return { dirs, files }
}

/** Finds SKILL.md files up to `depth` levels below `dir` (skills may be grouped in folders). */
async function findSkillFiles(dir: string, depth = 3, visited = new Set<string>()): Promise<string[]> {
  if (depth < 0) return []
  const found: string[] = []
  for (const sub of (await listEntries(dir, visited)).dirs) {
    if (await exists(join(sub, 'SKILL.md'))) found.push(join(sub, 'SKILL.md'))
    else found.push(...(await findSkillFiles(sub, depth - 1, visited)))
  }
  return found
}

/** Finds `*.md` command files below `dir`, nested folders included, up to `depth` levels. */
async function findCommandFiles(dir: string, depth = 5, visited = new Set<string>()): Promise<string[]> {
  if (depth < 0) return []
  const { dirs, files } = await listEntries(dir, visited)
  const found = files.filter((file) => file.endsWith('.md'))
  for (const sub of dirs) found.push(...(await findCommandFiles(sub, depth - 1, visited)))
  return found
}

async function readItems(root: string, source: CommandSource, prefix = ''): Promise<CommandItem[]> {
  const items: CommandItem[] = []
  for (const file of await findSkillFiles(join(root, 'skills'))) {
    const text = await readFile(file, 'utf8').catch(() => '')
    const fm = parseFrontmatter(text)
    const name = typeof fm.name === 'string' && fm.name ? fm.name : basename(join(file, '..'))
    const description = typeof fm.description === 'string' ? fm.description : firstLine(text)
    items.push({
      name: `${prefix}${name}`,
      description: description.slice(0, 200),
      source,
      interactive: false,
    })
  }
  const commandsDir = join(root, 'commands')
  for (const file of await findCommandFiles(commandsDir)) {
    const text = await readFile(file, 'utf8').catch(() => '')
    const fm = parseFrontmatter(text)
    // Nested commands are namespaced with ":" (commands/frontend/build.md → frontend:build).
    const name = relative(commandsDir, file).replace(/\.md$/, '').split('/').join(':')
    const description = typeof fm.description === 'string' ? fm.description : firstLine(text)
    items.push({
      name: `${prefix}${name}`,
      description: description.slice(0, 200),
      source,
      interactive: false,
    })
  }
  return items
}

async function pluginRoots(configDir: string): Promise<Array<{ name: string; path: string }>> {
  try {
    const data = JSON.parse(await readFile(join(configDir, 'plugins', 'installed_plugins.json'), 'utf8')) as {
      plugins?: Record<string, Array<{ installPath?: string }>>
    }
    return Object.entries(data.plugins ?? {}).flatMap(([key, installs]) => {
      const path = installs?.at(-1)?.installPath
      return path ? [{ name: key.split('@')[0] ?? key, path }] : []
    })
  } catch {
    return []
  }
}

/** Builtin + profile + project + plugin commands, de-duplicated by name (first source wins). */
export async function loadCommands(configDir: string, cwd: string): Promise<CommandItem[]> {
  const lists: CommandItem[][] = [
    await readItems(join(cwd, '.claude'), 'project'),
    await readItems(configDir, 'profile'),
  ]
  for (const plugin of await pluginRoots(configDir))
    lists.push(await readItems(plugin.path, 'plugin', `${plugin.name}:`))
  lists.push(BUILTIN_COMMANDS)
  const seen = new Set<string>()
  const result: CommandItem[] = []
  for (const item of lists.flat()) {
    if (seen.has(item.name)) continue
    seen.add(item.name)
    result.push(item)
  }
  return result
}

/** Cheap change detector: mtimes of the directories commands are read from. */
export async function commandsSignature(configDir: string, cwd: string): Promise<string> {
  const paths = [
    join(configDir, 'skills'),
    join(configDir, 'commands'),
    join(configDir, 'plugins', 'installed_plugins.json'),
    join(cwd, '.claude', 'skills'),
    join(cwd, '.claude', 'commands'),
  ]
  const mtimes = await Promise.all(
    paths.map((p) =>
      stat(p).then(
        (s) => s.mtimeMs,
        () => 0,
      ),
    ),
  )
  return mtimes.join(':')
}
