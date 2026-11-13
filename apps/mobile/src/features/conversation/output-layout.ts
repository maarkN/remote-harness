/**
 * Tools whose output keeps its columns (commands, searches, file contents and lists, patches): it
 * scrolls sideways. Every other tool's output is prose (subagent results, fetched pages, MCP tools,
 * edit confirmations) and wraps to the card (#544).
 */
const COLUMN_OUTPUT: ReadonlySet<string> = new Set([
  'Bash',
  'BashOutput',
  'Grep',
  'Glob',
  'Read',
  'LS',
  'NotebookRead',
  // Codex
  'exec',
  'apply_patch',
])

/** Whether a tool's output wraps to the card's width instead of scrolling sideways. */
export function outputWraps(toolName: string | undefined): boolean {
  return toolName === undefined || !COLUMN_OUTPUT.has(toolName)
}
