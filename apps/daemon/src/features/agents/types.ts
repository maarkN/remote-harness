import type {
  AccountLimits,
  AgentId,
  CodexPreset,
  CommandItem,
  PermissionMode,
  SessionStatus,
} from '@remote-harness/protocol'
import type { TranscriptFormat } from '../transcript/format.ts'

/** A main-session transcript on disk. */
export type TranscriptLocation = { sessionId: string; path: string; mtime: Date }

/** What the session list needs from a transcript; unknown items are null. */
export type TranscriptSummary = {
  title: string | null
  cwd: string | null
  /** Claude Code's permission mode. */
  permissionMode: PermissionMode | null
  /** Codex's approval policy. */
  approvalPolicy: string | null
  /** Codex's permission profile (`:workspace`…). */
  permissionProfile?: string | null
  /** Codex: model, effort and context read from the transcript (Claude Code's come from the status line). */
  status?: SessionStatus | null
  /** Codex: the account's latest rate limits read from the transcript. */
  limits?: Pick<AccountLimits, 'fiveHour' | 'sevenDay'> | null
}

/**
 * An approval dialog the agent shows in its TUI and no hook can answer (Gemini CLI): the phone's
 * answer is typed into the pane while the dialog is on screen.
 */
export type ApprovalDialog = {
  /** The tool and input shown on the phone, from the payload of the hook announcing the dialog. */
  request(payload: Record<string, unknown>): { tool: string; input: Record<string, unknown> }
  /** The dialog is on this pane capture (and its allow option is the one `allowKeys` picks). */
  isOpen(screen: string): boolean
  /** tmux keys that allow this one call. */
  allowKeys: string[]
  /** tmux keys that reject it. */
  denyKeys: string[]
}

/**
 * What differs between coding-agent CLIs as far as the daemon is concerned. The session registry,
 * transport, push, mute and pane features stay agent-agnostic and ask the session's adapter.
 */
export type AgentAdapter = {
  id: AgentId
  /** Product name ("Claude Code"). */
  name: string
  /** Command on the PATH that starts the CLI. */
  command: string
  /** Environment variable naming the config dir, or null when the CLI has none. */
  configDirEnv: string | null
  /** Config dir used when a profile does not say otherwise ("~/.claude"); launched with the variable unset. */
  defaultConfigDir: string
  /** Value of `configDirEnv` for a profile's config dir; the dir itself when absent. */
  configDirEnvValue?(configDir: string): string
  /** Whether a profile's config dir can be one of this CLI's (all when absent). */
  acceptsConfigDir?(configDir: string): boolean
  /** Arguments that resume an existing session. */
  resumeArgs(sessionId: string): string[]
  /** Arguments that start in a new git worktree with that name; null when the CLI cannot. */
  worktreeArgs(name: string): string[] | null
  /** Arguments that give a new session a display name; null when the CLI has none. */
  nameArgs(name: string): string[] | null
  /**
   * A command submitted in the pane once a new session registers, naming it (Codex `/rename`);
   * null when the CLI names sessions with `nameArgs` or not at all.
   */
  renameCommand(name: string): string | null
  /** How the CLI writes its transcripts (one module per format). */
  transcript: TranscriptFormat
  /** Main-session transcripts of a config dir modified since `cutoffMs`. */
  findTranscripts(configDir: string, cutoffMs: number): Promise<TranscriptLocation[]>
  /** Title, folder and mode of a transcript; throws when it cannot be read. */
  readSummary(path: string, configDir: string): Promise<TranscriptSummary>
  /** Slash commands offered for a session in `cwd`. */
  commands(configDir: string, cwd: string): Promise<CommandItem[]>
  /** Cheap change detector for `commands` (directory mtimes). */
  commandsSignature(configDir: string, cwd: string): Promise<string>
  input: {
    /** Least wait between the paste and the Enter that submits it. */
    minEnterDelayMs: number
    /** Inserts a line break when typing (the `type` input strategy): literal text, then keys. */
    newline: { literal?: string; keys: string[] }
    /** Keys sent after typing, before Enter (closing autocomplete menus); a stray Esc arms "edit previous" in Codex. */
    beforeSubmit: string[]
  }
  /** Where the daemon's hooks go and in which shape. */
  hooks: { style: 'claude-settings' | 'codex-hooks' | 'gemini-hooks'; file(configDir: string): string }
  /** The daemon wraps the CLI's status line (Claude Code only). */
  statusLine: boolean
  /** Profiles may route the CLI through a model provider (OpenRouter). */
  providers: boolean
  /** The TUI's permission modes can be switched from the app (Shift+Tab cycle). */
  modes: boolean
  /**
   * Permission presets switched by submitting a command in the pane (Codex `/permissions <id>`);
   * null when the CLI has none. Never full access.
   */
  presets: { command(preset: CodexPreset): string } | null
  /**
   * A permission answer may add allow rules or switch the mode (Claude Code). Codex treats either as
   * a failed hook, so its requests get Allow / Deny only.
   */
  permissionRules: boolean
  /** The approval dialog answered through the pane; null when hooks answer approvals (or nothing does). */
  approvalDialog: ApprovalDialog | null
  /**
   * One non-interactive call with a small model and no tools: rewrites a dictated transcript, or
   * (with its own system prompt, the material on stdin) writes a commit message. `null` when the CLI
   * has no such mode. `parse` reads the answer from its stdout (null when there is none).
   */
  polish: { args(text: string, systemPrompt?: string): string[]; parse(stdout: string): string | null } | null
}
