import type { Dirent } from 'node:fs'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import type { CommandItem, CommandSource } from '@remote-harness/protocol'
import { parse as parseYaml } from 'yaml'

/**
 * Readers for the skills and custom commands the coding-agent CLIs keep as files. Each agent's
 * loader picks the folders its CLI reads and how it names what it finds; the walking, the
 * frontmatter and the change detector live here once.
 */

type Frontmatter = { name?: unknown; description?: unknown; type?: unknown }

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

/** First line of prose after the frontmatter, for files without a description. */
export function firstLine(text: string): string {
  const body = text.replace(/^---[\s\S]*?---\s*/, '')
  return (
    body
      .split('\n')
      .find((l) => l.trim() && !l.startsWith('#'))
      ?.trim()
      .slice(0, 120) ?? ''
  )
}

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' }

/**
 * The string value of a top-level `key = …` in a TOML file: basic (`"…"`, escapes read), literal
 * (`'…'`) and their multi-line forms. Enough for the `description` and `prompt` of a command file;
 * anything else (or a malformed value) is null.
 */
export function tomlString(text: string, key: string): string | null {
  const head = new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*`, 'm').exec(text)
  if (!head) return null
  const rest = text.slice(head.index + head[0].length)
  for (const quote of ['"""', "'''"]) {
    if (!rest.startsWith(quote)) continue
    const end = rest.indexOf(quote, quote.length)
    if (end < 0) return null
    const raw = rest.slice(quote.length, end).replace(/^\r?\n/, '')
    return quote === '"""' ? unescapeBasic(raw) : raw
  }
  const basic = /^"((?:[^"\\\n]|\\.)*)"/.exec(rest)
  if (basic) return unescapeBasic(basic[1] ?? '')
  const literal = /^'([^'\n]*)'/.exec(rest)
  return literal ? (literal[1] ?? '') : null
}

function unescapeBasic(raw: string): string {
  return raw.replace(/\\(.)/g, (whole, char: string) => ESCAPES[char] ?? whole)
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * The entries of `dir` as directories and files, following symlinks: skill managers link skill
 * folders into `skills/`, and the CLIs read them (#538). Broken links are left out. A directory
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

type SkillWalk = { depth: number; skipHidden: boolean }

/** Finds SKILL.md files up to `depth` levels below `dir` (0 = only its direct subfolders). */
async function findSkillFiles(dir: string, walk: SkillWalk, visited = new Set<string>()): Promise<string[]> {
  if (walk.depth < 0) return []
  const found: string[] = []
  for (const sub of (await listEntries(dir, visited)).dirs) {
    if (walk.skipHidden && basename(sub).startsWith('.')) continue
    if (await exists(join(sub, 'SKILL.md'))) found.push(join(sub, 'SKILL.md'))
    else found.push(...(await findSkillFiles(sub, { ...walk, depth: walk.depth - 1 }, visited)))
  }
  return found
}

/** Finds command files with one of `extensions` below `dir`, nested folders included. */
async function findCommandFiles(
  dir: string,
  extensions: readonly string[],
  depth = 5,
  visited = new Set<string>(),
): Promise<string[]> {
  if (depth < 0) return []
  const { dirs, files } = await listEntries(dir, visited)
  const found = files.filter((file) => extensions.some((ext) => file.endsWith(ext)))
  for (const sub of dirs) found.push(...(await findCommandFiles(sub, extensions, depth - 1, visited)))
  return found
}

/** A skill folder as found: its name (frontmatter, else the folder), description and frontmatter. */
export type FoundSkill = { name: string; description: string; frontmatter: Frontmatter }

/** Skills (`<name>/SKILL.md`) below `dir`, grouped folders included up to `depth`. */
export async function findSkills(
  dir: string,
  { depth = 3, skipHidden = false }: { depth?: number; skipHidden?: boolean } = {},
): Promise<FoundSkill[]> {
  const skills: FoundSkill[] = []
  for (const file of await findSkillFiles(dir, { depth, skipHidden })) {
    const text = await readFile(file, 'utf8').catch(() => '')
    const frontmatter = parseFrontmatter(text)
    const name =
      typeof frontmatter.name === 'string' && frontmatter.name ? frontmatter.name : basename(dirname(file))
    const description =
      typeof frontmatter.description === 'string' ? frontmatter.description : firstLine(text)
    skills.push({ name, description, frontmatter })
  }
  return skills
}

export type ItemShape = { source: CommandSource; prefix?: CommandItem['prefix']; namePrefix?: string }

export function commandItem(name: string, description: string, shape: ItemShape): CommandItem {
  return {
    name: `${shape.namePrefix ?? ''}${name}`,
    description: description.slice(0, 200),
    source: shape.source,
    interactive: false,
    prefix: shape.prefix ?? '/',
  }
}

/** Skills below `dir` as commands (`/name`, or `$name` with that prefix). */
export async function readSkills(
  dir: string,
  shape: ItemShape & { depth?: number; skipHidden?: boolean },
): Promise<CommandItem[]> {
  const skills = await findSkills(dir, shape)
  return skills.map((skill) => commandItem(skill.name, skill.description, shape))
}

/** Name of a command file: its path below the commands folder, nested folders joined by ":". */
function commandName(commandsDir: string, file: string, extension: string): string {
  return relative(commandsDir, file).slice(0, -extension.length).split('/').join(':')
}

/** Markdown command files below `dir` (nested folders too), described by their frontmatter or first line. */
export async function readMarkdownCommands(dir: string, shape: ItemShape): Promise<CommandItem[]> {
  const items: CommandItem[] = []
  for (const file of await findCommandFiles(dir, ['.md'])) {
    const text = await readFile(file, 'utf8').catch(() => '')
    const fm = parseFrontmatter(text)
    const description = typeof fm.description === 'string' ? fm.description : firstLine(text)
    items.push(commandItem(commandName(dir, file, '.md'), description, shape))
  }
  return items
}

/** TOML command files below `dir` (Gemini CLI, Qwen Code): `description`, else the prompt's first line. */
export async function readTomlCommands(dir: string, shape: ItemShape): Promise<CommandItem[]> {
  const items: CommandItem[] = []
  for (const file of await findCommandFiles(dir, ['.toml'])) {
    const text = await readFile(file, 'utf8').catch(() => '')
    const description = tomlString(text, 'description') ?? firstLine(tomlString(text, 'prompt') ?? '')
    items.push(commandItem(commandName(dir, file, '.toml'), description, shape))
  }
  return items
}

/** The lists in priority order, without repeats: the first item with a given prefix and name wins. */
export function mergeCommands(lists: readonly (readonly CommandItem[])[]): CommandItem[] {
  const seen = new Set<string>()
  const result: CommandItem[] = []
  for (const item of lists.flat()) {
    const key = `${item.prefix}${item.name}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

/** Cheap change detector: the mtimes of the folders and files a list is read from (0 when missing). */
export async function pathsSignature(paths: readonly string[]): Promise<string> {
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

/**
 * `cwd` and each parent up to the repository root (the nearest folder holding `.git`), nearest
 * first; just `cwd` outside a repository.
 */
export async function foldersUpToRepoRoot(cwd: string): Promise<string[]> {
  const folders: string[] = []
  for (let dir = cwd; ; dir = dirname(dir)) {
    folders.push(dir)
    if (await exists(join(dir, '.git'))) return folders
    if (dirname(dir) === dir) return [cwd]
  }
}

/** The repository root of `cwd` (nearest folder with `.git`), else `cwd` itself. */
export async function projectRoot(cwd: string): Promise<string> {
  return (await foldersUpToRepoRoot(cwd)).at(-1) ?? cwd
}

/** The first of `paths` that exists, if any. */
export async function firstExisting(paths: readonly string[]): Promise<string | null> {
  for (const path of paths) if (await exists(path)) return path
  return null
}
