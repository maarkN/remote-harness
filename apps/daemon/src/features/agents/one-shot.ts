import type { Profile } from '@remote-harness/protocol'
import { isDefaultConfigDir } from '../hooks/launcher.ts'
import type { AgentAdapter } from './types.ts'

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
