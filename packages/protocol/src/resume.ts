import type { AgentId } from './domain.ts'

/**
 * The arguments that reopen an existing session, per agent CLI. One table for the daemon, which runs
 * them to resume a session in tmux, and for the app, which shows the command to resume it on the
 * computer.
 */
const RESUME_ARGS: Record<AgentId, (sessionId: string) => string[]> = {
  claude: (id) => ['--resume', id],
  codex: (id) => ['resume', id],
  gemini: (id) => ['--resume', id],
  kimi: (id) => ['--session', id],
  qwen: (id) => ['--resume', id],
}

export function resumeArgs(agent: AgentId, sessionId: string): string[] {
  return RESUME_ARGS[agent](sessionId)
}
