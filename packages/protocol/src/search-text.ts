import type { TranscriptEntry } from './domain.ts'

/** Tool input fields worth searching, in order (the rest is structure, not prose). */
const TOOL_FIELDS = ['description', 'command', 'file_path', 'pattern', 'path', 'url', 'query', 'prompt']

/**
 * The text a transcript entry is searched by, on the device (the history cache's FTS5 index) and on
 * the computer (`transcript.search`) alike, so both halves of the search find the same entries.
 * Empty for entries without any.
 */
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
