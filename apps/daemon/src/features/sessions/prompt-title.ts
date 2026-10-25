/** Blocks that are never the user's words: harness context and command output. */
const CONTEXT_TAGS =
  'system-reminder|local-command-caveat|local-command-stdout|local-command-stderr|bash-stdout|bash-stderr'
const CONTEXT_BLOCK = new RegExp(`<(${CONTEXT_TAGS})\\b[^>]*>[\\s\\S]*?</\\1>`, 'g')
/** A context block cut off by a truncated prompt runs to the end. */
const CONTEXT_UNCLOSED = new RegExp(`<(?:${CONTEXT_TAGS})\\b[^>]*>[\\s\\S]*$`)
const PASTED_BLOCK = /<pasted_content\b[^>]*>([\s\S]*?)<\/pasted_content>/g
const COMMAND_NAME = /<command-name>([\s\S]*?)<\/command-name>/
const COMMAND_ARGS = /<command-args>([\s\S]*?)<\/command-args>/
/** Prompts that run something instead of asking: a slash command or a `!` shell line. */
const COMMAND_PROMPT = /<(?:command-name|bash-input)>/
/** Harness markup still left: tag names with `-` or `_` (`<command-message>`, `<pasted_content …>`). */
const MARKUP_TAG = /<\/?[a-z]+[-_][a-z_-]*\b[^>]*>/g

export function oneLine(text: string, max = 80): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

const withoutMarkup = (text: string) => text.replace(MARKUP_TAG, ' ').trim()

/**
 * The title a prompt gives a session, without markup, or `null` when nothing is left: the user's
 * own words around pasted blocks, else the first line of the pasted text; a slash command gives the
 * command and its arguments. Harness context never counts.
 */
export function promptTitle(prompt: string): string | null {
  const text = prompt.replace(CONTEXT_BLOCK, ' ').replace(CONTEXT_UNCLOSED, ' ')
  const command = COMMAND_NAME.exec(text)?.[1]?.trim()
  if (command) {
    const args = COMMAND_ARGS.exec(text)?.[1]?.trim()
    return oneLine(args ? `${command} ${args}` : command)
  }
  const pasted: string[] = []
  const own = withoutMarkup(
    text.replace(PASTED_BLOCK, (_block, content: string) => {
      pasted.push(content)
      return ' '
    }),
  )
  if (own) return oneLine(own)
  for (const content of pasted) {
    const line = content.split('\n').map(withoutMarkup).find(Boolean)
    if (line) return oneLine(line)
  }
  return null
}

/** Whether the prompt is a slash command or a shell line (weaker than a question as a first prompt). */
export function isCommandPrompt(prompt: string): boolean {
  return COMMAND_PROMPT.test(prompt)
}

/** A title that is still raw markup (left by daemons before `promptTitle`). */
export function isMarkupTitle(title: string): boolean {
  return title.startsWith('<')
}
