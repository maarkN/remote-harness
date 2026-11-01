/**
 * Claude Code's `Workflow` tool (multi-agent orchestration) as it shows in a transcript: the call's
 * script opens with `export const meta = { name, description, phases }` (a pure literal, by the
 * tool's own contract) and the launch result names the run (`Task ID`, `Transcript dir`). Used by the
 * parser only; nothing here throws.
 */
import type { WorkflowCall, WorkflowLaunch, WorkflowPhase } from '@remote-harness/protocol'

export const WORKFLOW_TOOL = 'Workflow'

const QUOTES = new Set(['"', "'", '`'])

/** Index just past the `{…}` / `[…]` block opening at `start`, skipping strings; -1 when unbalanced. */
function blockEnd(text: string, start: number): number {
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < text.length; i++) {
    const ch = text[i] ?? ''
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (QUOTES.has(ch)) quote = ch
    else if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return -1
}

/** The block (`{…}` or `[…]`) that `opener` introduces, as [start, end) in `text`; null when absent or unbalanced. */
function block(text: string, opener: RegExp): [number, number] | null {
  const match = opener.exec(text)
  if (!match) return null
  const start = match.index + match[0].length - 1
  const end = blockEnd(text, start)
  return end < 0 ? null : [start, end]
}

const ESCAPES: Record<string, string> = { n: '\n', t: '\t' }

function decodeEscapes(raw: string): string {
  return raw.replace(/\\(.)/gs, (_, ch: string) => ESCAPES[ch] ?? ch)
}

/** The string literal assigned to `key` in an object literal's text (first match), trimmed; null when none or empty. */
function stringField(literal: string, key: string): string | null {
  const match = new RegExp(`\\b${key}\\s*:\\s*(["'\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, 's').exec(literal)
  const value = match?.[2] === undefined ? null : decodeEscapes(match[2]).trim()
  return value || null
}

/** The `phases` of a meta literal: every `{ title, detail? }` with a title, in order. */
function phases(literal: string): WorkflowPhase[] {
  const range = block(literal, /\bphases\s*:\s*\[/)
  if (!range) return []
  const list = literal.slice(range[0] + 1, range[1] - 1)
  const out: WorkflowPhase[] = []
  let at = list.indexOf('{')
  while (at >= 0) {
    const end = blockEnd(list, at)
    if (end < 0) break
    const item = list.slice(at, end)
    const title = stringField(item, 'title')
    if (title) out.push({ title, detail: stringField(item, 'detail') })
    at = list.indexOf('{', end)
  }
  return out
}

/** The `export const meta = {…}` literal of a workflow script, or null. */
function metaLiteral(script: string): string | null {
  const range = block(script, /export\s+const\s+meta\s*=\s*\{/)
  return range ? script.slice(range[0], range[1]) : null
}

/** What a `Workflow` call declares, from its input: the script's `meta`, else a saved workflow's name. */
export function workflowCall(input: Record<string, unknown>): WorkflowCall {
  const script = typeof input.script === 'string' ? input.script : null
  const literal = script ? metaLiteral(script) : null
  const saved = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : null
  if (!literal) return { name: saved, description: null, phases: [] }
  // Phases have `title`/`detail`, never `name`/`description`, but a detail could mention either word
  // followed by a colon: read the top-level fields with the phases cut out.
  const range = block(literal, /\bphases\s*:\s*\[/)
  const top = range ? literal.slice(0, range[0]) + literal.slice(range[1]) : literal
  return {
    name: stringField(top, 'name') ?? saved,
    description: stringField(top, 'description'),
    phases: phases(literal),
  }
}

const LAUNCHED = /^\s*Workflow launched in background\b/

/** The run a `Workflow` call's result names; null for the result of any other tool. */
export function workflowLaunch(text: string): WorkflowLaunch | null {
  if (!LAUNCHED.test(text)) return null
  // `Task ID` follows the opening sentence on the first line; the other fields open their own lines.
  const field = (name: string): string | null =>
    new RegExp(`\\b${name}:[ \\t]*(.+)$`, 'm').exec(text)?.[1]?.trim() || null
  const dir = field('Transcript dir')
  return {
    taskId: field('Task ID'),
    runId: dir
      ? (dir
          .split(/[\\/]+/)
          .filter(Boolean)
          .at(-1) ?? null)
      : null,
    summary: field('Summary'),
  }
}
