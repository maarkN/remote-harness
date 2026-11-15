import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CommandItem, CommandSource } from '@remote-harness/protocol'
import { findSkills, firstExisting, mergeCommands, pathsSignature, projectRoot } from './command-files.ts'

const item = (name: string, description: string, interactive = false): CommandItem => ({
  name,
  description,
  source: 'builtin',
  interactive,
  prefix: '/',
})

/**
 * Native Kimi CLI slash commands (kimi-cli 1.52), described in English. Review on every CLI update.
 * `interactive` commands open a menu or a long view in the TUI, so the app switches to the raw
 * terminal after sending them. Commands that quit, log in or out, or approve everything (`/yolo`,
 * `/afk`) are left out.
 */
export const KIMI_COMMANDS: CommandItem[] = [
  item('model', 'Choose the model and thinking', true),
  item('new', 'Start a new session'),
  item('clear', 'Clear the context and start over'),
  item('compact', 'Summarize the conversation to free context'),
  item('sessions', 'Browse and resume sessions', true),
  item('title', 'Rename the session'),
  item('plan', 'Turn plan mode on or off, or view the plan'),
  item('init', 'Create an AGENTS.md file with instructions for Kimi'),
  item('undo', 'Go back to an earlier message', true),
  item('fork', 'Fork the session'),
  item('add-dir', 'Add a workspace directory'),
  item('task', 'Show background tasks', true),
  item('mcp', 'Show MCP servers and their tools', true),
  item('hooks', 'Show the configured hooks', true),
  item('usage', 'Show token usage and limits', true),
  item('export', 'Export the session'),
  item('btw', 'Ask a side question without changing the conversation'),
  item('help', 'Show help', true),
]

/** Brand folders Kimi merges (Kimi's own first), then its generic folders (the first that exists). */
const BRANDS = ['.kimi', '.claude', '.codex'] as const

async function kimiSkillDirs(cwd: string, home: string) {
  const root = await projectRoot(cwd)
  const generic = await firstExisting([
    join(home, '.config', 'agents', 'skills'),
    join(home, '.agents', 'skills'),
  ])
  const user = [...BRANDS.map((b) => join(home, b, 'skills')), ...(generic ? [generic] : [])]
  return {
    // A session in the home folder: its skill folders are the personal ones.
    project: [...BRANDS.map((b) => join(root, b, 'skills')), join(root, '.agents', 'skills')].filter(
      (dir) => !user.includes(dir),
    ),
    user,
    watched: [
      ...BRANDS.map((b) => join(root, b, 'skills')),
      join(root, '.agents', 'skills'),
      ...BRANDS.map((b) => join(home, b, 'skills')),
      join(home, '.config', 'agents', 'skills'),
      join(home, '.agents', 'skills'),
    ],
  }
}

/** A Kimi skill runs as `/skill:<name>`; a flow skill (`type: flow`) also as `/flow:<name>`. */
async function readKimiSkills(dir: string, source: CommandSource): Promise<CommandItem[]> {
  return (await findSkills(dir)).flatMap((skill) => {
    const item = (kind: 'skill' | 'flow'): CommandItem => ({
      name: `${kind}:${skill.name}`,
      description: skill.description.slice(0, 200),
      source,
      interactive: false,
      prefix: '/',
    })
    return skill.frontmatter.type === 'flow' ? [item('skill'), item('flow')] : [item('skill')]
  })
}

/**
 * Built-ins plus the Kimi skills of the project root and the user's folders. Kimi reads skills from
 * these folders whatever `KIMI_SHARE_DIR` (the profile's config folder) says.
 */
export async function loadKimiCommands(
  _configDir: string,
  cwd: string,
  home = homedir(),
): Promise<CommandItem[]> {
  const dirs = await kimiSkillDirs(cwd, home)
  const lists: CommandItem[][] = []
  for (const dir of dirs.project) lists.push(await readKimiSkills(dir, 'project'))
  for (const dir of dirs.user) lists.push(await readKimiSkills(dir, 'profile'))
  lists.push(KIMI_COMMANDS)
  return mergeCommands(lists)
}

export async function kimiCommandsSignature(
  _configDir: string,
  cwd: string,
  home = homedir(),
): Promise<string> {
  return pathsSignature((await kimiSkillDirs(cwd, home)).watched)
}
