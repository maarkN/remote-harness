import { join } from 'node:path'
import type { CommandItem } from '@remote-harness/protocol'
import { mergeCommands, pathsSignature, readTomlCommands } from './command-files.ts'

const item = (name: string, description: string, interactive = false): CommandItem => ({
  name,
  description,
  source: 'builtin',
  interactive,
  prefix: '/',
})

/**
 * Native Gemini CLI slash commands (gemini-cli 0.66), described in English. Review on every CLI
 * update. `interactive` commands open a dialog or a long view in the TUI, so the app switches to the
 * raw terminal after sending them. Commands that quit, log out or change the approval mode (yolo)
 * are left out.
 */
export const GEMINI_COMMANDS: CommandItem[] = [
  item('model', 'Choose the model', true),
  item('clear', 'Clear the screen and start a new conversation'),
  item('compress', 'Replace the conversation with a summary to free context'),
  item('rewind', 'Go back to an earlier message', true),
  item('resume', 'Browse and resume saved conversations', true),
  item('restore', 'Restore files from a checkpoint', true),
  item('memory', 'Show or change the memory loaded from GEMINI.md', true),
  item('init', 'Create a GEMINI.md file with instructions for Gemini'),
  item('stats', 'Show session statistics and token usage', true),
  item('tools', 'List the available tools', true),
  item('mcp', 'List MCP servers and their tools', true),
  item('skills', 'List and manage skills', true),
  item('extensions', 'List the active extensions', true),
  item('hooks', 'View and manage hooks', true),
  item('settings', 'Open the settings', true),
  item('directory', 'Add or show workspace directories', true),
  item('copy', 'Copy the last response'),
  item('export-session', 'Export the conversation'),
  item('about', 'Show version information', true),
  item('help', 'Show help', true),
]

/**
 * Built-ins plus the custom commands (`commands/**` TOML files) of the project's `.gemini/` and the
 * profile's config folder. Gemini skills are left out: the model activates them, no slash command does.
 */
export async function loadGeminiCommands(configDir: string, cwd: string): Promise<CommandItem[]> {
  const project = join(cwd, '.gemini', 'commands')
  return mergeCommands([
    // A session in the home folder: its `.gemini` is the profile's.
    project === join(configDir, 'commands') ? [] : await readTomlCommands(project, { source: 'project' }),
    await readTomlCommands(join(configDir, 'commands'), { source: 'profile' }),
    GEMINI_COMMANDS,
  ])
}

export async function geminiCommandsSignature(configDir: string, cwd: string): Promise<string> {
  return pathsSignature([join(cwd, '.gemini', 'commands'), join(configDir, 'commands')])
}
