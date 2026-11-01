import type { CommandItem } from '@remote-harness/protocol'

const item = (name: string, description: string, interactive = false): CommandItem => ({
  name,
  description,
  source: 'builtin',
  interactive,
})

/**
 * Native Qwen Code slash commands (qwen-code 0.26), described in English. Review on every CLI
 * update. `interactive` commands open a dialog or a long view in the TUI, so the app switches to the
 * raw terminal after sending them. Commands that quit, log in or change the approval mode are left
 * out.
 */
export const QWEN_COMMANDS: CommandItem[] = [
  item('model', 'Choose the model', true),
  item('clear', 'Clear the screen and start a new conversation'),
  item('compress', 'Replace the conversation with a summary to free context'),
  item('resume', 'Browse and resume saved conversations', true),
  item('rename', 'Rename the session'),
  item('rewind', 'Go back to an earlier message', true),
  item('memory', 'Show or change the memory loaded from QWEN.md', true),
  item('init', 'Create a QWEN.md file with instructions for Qwen'),
  item('context', 'Show what fills the context window', true),
  item('stats', 'Show session statistics and token usage', true),
  item('tools', 'List the available tools', true),
  item('mcp', 'List MCP servers and their tools', true),
  item('agents', 'Manage subagents', true),
  item('skills', 'List and manage skills', true),
  item('hooks', 'View and manage hooks', true),
  item('diff', 'Show the changes made in this session', true),
  item('copy', 'Copy the last response'),
  item('export', 'Export the conversation'),
  item('btw', 'Ask a side question without changing the conversation'),
  item('help', 'Show help', true),
]
