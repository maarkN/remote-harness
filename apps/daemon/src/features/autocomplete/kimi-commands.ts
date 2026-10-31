import type { CommandItem } from '@remote-harness/protocol'

const item = (name: string, description: string, interactive = false): CommandItem => ({
  name,
  description,
  source: 'builtin',
  interactive,
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
