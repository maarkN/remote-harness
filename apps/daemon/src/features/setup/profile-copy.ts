import { constants } from 'node:fs'
import { copyFile, cp, lstat, mkdir, readdir, realpath, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { readJsonFile, writeJsonAtomic } from '../../infra/fs.ts'
import { BACKUP_SUFFIX } from '../hooks/installer.ts'
import { removeOurHooks } from '../hooks/settings-hooks.ts'
import { unwrapStatusLine } from '../status-line/wrapper.ts'

/**
 * Bringing the main Claude Code profile's configuration into a new profile (#556). A list of named
 * items, never a folder copy: the login, credentials, history and per-project state stay out by
 * construction. Nothing the new profile already has is overwritten.
 */

export const COPY_ITEMS = ['settings', 'memory', 'skills', 'commands', 'agents', 'plugins', 'mcp'] as const
export type CopyItem = (typeof COPY_ITEMS)[number]

/** The folders `link` applies to: content the user curates, with no per-profile state in it. */
export const LINKABLE_ITEMS = ['skills', 'commands', 'agents'] as const
type LinkableItem = (typeof LINKABLE_ITEMS)[number]

export type CopyChoice = { items: ReadonlySet<CopyItem>; link: boolean }

/** `copied`/`linked`: written; `merged`: added to what the profile had; `kept`: it already had it all. */
export type CopyStatus = 'copied' | 'linked' | 'merged' | 'kept' | 'missing'
export type CopyOutcome = { item: CopyItem; status: CopyStatus }

/** The main profile: its config folder (`~/.claude`) and its `.claude.json` (`~/.claude.json`). */
export type MainProfile = { dir: string; json: string }

const PLUGIN_LISTS = ['installed_plugins.json', 'known_marketplaces.json'] as const

type Json = Record<string, unknown>

function isRecord(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * The main profile's settings added to the new profile's, by top-level key, the new profile's keys
 * winning. The daemon's hooks and status line wrapper are left out: setup installs the new
 * profile's own.
 */
export function mergeSettings(target: Json, main: Json): Json {
  const clean = unwrapStatusLine(removeOurHooks(main))
  const result: Json = { ...target }
  for (const [key, value] of Object.entries(clean)) if (!(key in result)) result[key] = value
  return result
}

/** The main profile's user-scoped MCP servers added by name to the new profile's `.claude.json`. */
export function mergeMcpServers(target: Json, mainServers: Json): Json {
  const current = isRecord(target.mcpServers) ? target.mcpServers : {}
  const servers: Json = { ...current }
  for (const [name, server] of Object.entries(mainServers)) if (!(name in servers)) servers[name] = server
  return Object.keys(servers).length === Object.keys(current).length
    ? target
    : { ...target, mcpServers: servers }
}

async function exists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    () => false,
  )
}

async function readObject(path: string): Promise<Json | null> {
  const data = await readJsonFile(path).catch(() => undefined)
  return isRecord(data) ? data : null
}

/** Writes `next` when it differs from what is on disk, backing up the previous file. */
async function writeMerged(
  path: string,
  previous: Json | null,
  next: Json,
  mode?: number,
): Promise<CopyStatus> {
  if (previous && JSON.stringify(previous) === JSON.stringify(next)) return 'kept'
  if (previous) await copyFile(path, `${path}${BACKUP_SUFFIX}`)
  await writeJsonAtomic(path, next, mode)
  return previous ? 'merged' : 'copied'
}

async function copySettings(main: MainProfile, target: string): Promise<CopyStatus> {
  const source = await readObject(join(main.dir, 'settings.json'))
  if (!source) return 'missing'
  const path = join(target, 'settings.json')
  const previous = await readObject(path)
  return writeMerged(path, previous, mergeSettings(previous ?? {}, source))
}

async function copyMcpServers(main: MainProfile, target: string): Promise<CopyStatus> {
  const source = await readObject(main.json)
  const servers = isRecord(source?.mcpServers) ? source.mcpServers : {}
  if (Object.keys(servers).length === 0) return 'missing'
  const path = join(target, '.claude.json')
  const previous = await readObject(path)
  // Holds the profile's login once Claude Code writes it: private to the user.
  return writeMerged(path, previous, mergeMcpServers(previous ?? {}, servers), 0o600)
}

/** Copies a file the new profile does not have; never replaces one it has. */
async function copyMissingFile(from: string, to: string): Promise<CopyStatus> {
  if (!(await exists(from))) return 'missing'
  if (await exists(to)) return 'kept'
  await mkdir(join(to, '..'), { recursive: true })
  await copyFile(from, to, constants.COPYFILE_EXCL)
  return 'copied'
}

async function copyPluginLists(main: MainProfile, target: string): Promise<CopyStatus> {
  const statuses: CopyStatus[] = []
  for (const name of PLUGIN_LISTS)
    statuses.push(await copyMissingFile(join(main.dir, 'plugins', name), join(target, 'plugins', name)))
  if (statuses.includes('copied')) return 'copied'
  return statuses.includes('kept') ? 'kept' : 'missing'
}

async function sameFolder(a: string, b: string): Promise<boolean> {
  const [ra, rb] = await Promise.all([realpath(a).catch(() => a), realpath(b).catch(() => b)])
  return ra === rb
}

/**
 * A folder of the main profile (skills, commands, agents): copied, or linked, whole when the new
 * profile lacks it, else entry by entry for the entries it lacks. Links inside it stay links, with
 * relative targets made absolute: skill managers link skills in as `../../.agents/skills/x`, which
 * would point nowhere from another folder.
 */
async function copyFolder(
  main: MainProfile,
  target: string,
  item: LinkableItem,
  link: boolean,
): Promise<CopyStatus> {
  const from = join(main.dir, item)
  const to = join(target, item)
  if (!(await exists(from))) return 'missing'
  if (!(await exists(to))) {
    if (link) await symlink(from, to, 'dir')
    else await cp(from, to, { recursive: true, errorOnExist: true, force: false })
    return link ? 'linked' : 'copied'
  }
  if (await sameFolder(from, to)) return 'kept'
  let added = false
  for (const name of await readdir(from)) {
    const entry = join(to, name)
    if (await exists(entry)) continue
    if (link) await symlink(join(from, name), entry)
    else
      await cp(join(from, name), entry, {
        recursive: true,
        errorOnExist: true,
        force: false,
      })
    added = true
  }
  if (!added) return 'kept'
  return link ? 'linked' : 'merged'
}

/** Brings the chosen items of the main profile into `target`, in `COPY_ITEMS` order. */
export async function copyMainProfile(
  main: MainProfile,
  target: string,
  choice: CopyChoice,
): Promise<CopyOutcome[]> {
  const outcomes: CopyOutcome[] = []
  if (choice.items.size === 0) return outcomes
  await mkdir(target, { recursive: true })
  for (const item of COPY_ITEMS) {
    if (!choice.items.has(item)) continue
    let status: CopyStatus
    switch (item) {
      case 'settings':
        status = await copySettings(main, target)
        break
      case 'memory':
        status = await copyMissingFile(join(main.dir, 'CLAUDE.md'), join(target, 'CLAUDE.md'))
        break
      case 'plugins':
        status = await copyPluginLists(main, target)
        break
      case 'mcp':
        status = await copyMcpServers(main, target)
        break
      default:
        status = await copyFolder(main, target, item, choice.link)
    }
    outcomes.push({ item, status })
  }
  return outcomes
}
