import type { TranscriptEntry } from '@remote-harness/protocol'

/** Tool input fields worth searching, in order (the rest is structure, not prose). */
const TOOL_FIELDS = ['description', 'command', 'file_path', 'pattern', 'path', 'url', 'query', 'prompt']

/** The text the history cache indexes for full-text search; empty for entries without any. */
export function searchText(entry: TranscriptEntry): string {
  switch (entry.kind) {
    case 'user':
    case 'assistant_text':
    case 'thinking':
    case 'system':
      return entry.text
    case 'tool_use': {
      const fields = TOOL_FIELDS.map((field) => entry.input[field]).filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
      return [entry.name, ...fields].join(' ')
    }
    case 'tool_result':
      return entry.content
    case 'unknown':
      return ''
  }
}
