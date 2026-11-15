import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CommandItem, CommandSource } from '@remote-harness/protocol'
import { BUILTIN_COMMANDS } from './builtin-commands.ts'
import { mergeCommands, pathsSignature, readMarkdownCommands, readSkills } from './command-files.ts'

export { parseFrontmatter } from './command-files.ts'

/** Claude Code reads `skills/` and `commands/` the same way in the profile, the project and each plugin. */
async function readItems(root: string, source: CommandSource, namePrefix = ''): Promise<CommandItem[]> {
  return [
    ...(await readSkills(join(root, 'skills'), { source, namePrefix })),
    ...(await readMarkdownCommands(join(root, 'commands'), { source, namePrefix })),
  ]
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
  return mergeCommands(lists)
}

/** Cheap change detector: mtimes of the directories commands are read from. */
export async function commandsSignature(configDir: string, cwd: string): Promise<string> {
  return pathsSignature([
    join(configDir, 'skills'),
    join(configDir, 'commands'),
    join(configDir, 'plugins', 'installed_plugins.json'),
    join(cwd, '.claude', 'skills'),
    join(cwd, '.claude', 'commands'),
  ])
}
