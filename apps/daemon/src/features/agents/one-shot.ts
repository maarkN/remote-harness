import type { Profile } from '@remote-harness/protocol'
import { isDefaultConfigDir } from '../hooks/launcher.ts'
import type { AgentAdapter } from './types.ts'

export const POLISH_SYSTEM_PROMPT =
  'Rewrite the given dictated text into a clean prompt: remove filler words, hesitations and ' +
  'repetitions, fix punctuation and grammar, and keep technical terms, file names and code exactly ' +
  'as said. Respond with only the rewritten text, nothing else.'

/** The environment of a one-shot call: the profile's config dir when it is not the CLI's default. */
export function oneShotEnv(profile: Profile, adapter: AgentAdapter): Record<string, string> | undefined {
  return adapter.configDirEnv && !isDefaultConfigDir(profile.configDir)
    ? { [adapter.configDirEnv]: profile.configDir }
    : undefined
}

/** The answer of a one-shot call (`--output-format json`): its `result` text, null when empty or not JSON. */
export function parseOneShotResult(stdout: string): string | null {
  try {
    const parsed: unknown = JSON.parse(stdout)
    const result = (parsed as { result?: unknown } | null)?.result
    return typeof result === 'string' && result.trim().length > 0 ? result : null
  } catch {
    return null
  }
}

/** The answer of `codex exec --json`: the text of its last `agent_message` item, null when none. */
export function parseCodexExecResult(stdout: string): string | null {
  let answer: string | null = null
  for (const line of stdout.split('\n')) {
    if (!line.includes('"agent_message"')) continue
    try {
      const event = JSON.parse(line) as { type?: unknown; item?: { type?: unknown; text?: unknown } } | null
      const item = event?.type === 'item.completed' ? event.item : undefined
      if (item?.type === 'agent_message' && typeof item.text === 'string' && item.text.trim())
        answer = item.text
    } catch {
      // not a JSON line
    }
  }
  return answer
}
