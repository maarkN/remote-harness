import { z } from 'zod'

export const PermissionModeSchema = z.enum([
  'default',
  'acceptEdits',
  'plan',
  'auto',
  'dontAsk',
  'bypassPermissions',
])
export type PermissionMode = z.infer<typeof PermissionModeSchema>

/** Modes the app may request. `bypassPermissions` is never offered remotely. */
export const SelectableModeSchema = z.enum(['default', 'acceptEdits', 'plan', 'auto'])
export type SelectableMode = z.infer<typeof SelectableModeSchema>

/** Codex permission presets the app may request (`/permissions :read-only|:workspace`); never full access. */
export const CodexPresetSchema = z.enum(['read-only', 'workspace'])
export type CodexPreset = z.infer<typeof CodexPresetSchema>

/** Coding agents the app knows (badge, color); only those with a daemon adapter can run. */
export const AgentIdSchema = z.enum(['claude', 'codex', 'gemini', 'kimi', 'qwen'])
export type AgentId = z.infer<typeof AgentIdSchema>

/** An agent id in a message: one this parser does not know yet reads as absent (Claude Code). */
const wireAgentId = AgentIdSchema.optional().catch(undefined)

/** Display names of the agents (product names, not translated); the app's badges and the live status texts use them. */
export const AGENT_LABELS: Record<AgentId, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  kimi: 'Kimi',
  qwen: 'Qwen',
}

/** Model gateways a profile can route Claude Code through; a profile without one uses the Anthropic account. */
export const ProviderKindSchema = z.enum(['openrouter'])
export type ProviderKind = z.infer<typeof ProviderKindSchema>

/** Product names of the providers (not translated); shown in the dashed `via …` chip. */
export const PROVIDER_NAMES: Record<ProviderKind, string> = { openrouter: 'OpenRouter' }

export const ProviderSchema = z.object({
  kind: ProviderKindSchema,
  /** Anthropic-compatible endpoint; absent = the provider's own (`https://openrouter.ai/api`). */
  baseUrl: z.string().url().optional(),
  /** Default model of new sessions; absent = whatever the gateway serves for Claude Code's default. */
  model: z.string().min(1).optional(),
  smallFastModel: z.string().min(1).optional(),
})
export type Provider = z.infer<typeof ProviderSchema>

export const ProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  configDir: z.string().min(1),
  color: z.string().min(1),
  /** The agent this profile launches; absent means Claude Code (older configs and daemons). */
  agent: AgentIdSchema.optional(),
  /** The model provider; absent means the Anthropic account logged into Claude Code. */
  provider: ProviderSchema.optional(),
})
export type Profile = z.infer<typeof ProfileSchema>

/** A profile as the daemon sends it (`auth.ok`); the config file keeps the strict `ProfileSchema`. */
export const WireProfileSchema = ProfileSchema.extend({ agent: wireAgentId })

/** A model a provider lists; prices in USD per million tokens, `null` when the provider does not say. */
export const ModelInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  contextLength: z.number().int().positive().nullable(),
  promptPrice: z.number().nonnegative().nullable(),
  completionPrice: z.number().nonnegative().nullable(),
  /** Tool use (Claude Code needs it). */
  tools: z.boolean(),
  /** Extended thinking / reasoning. */
  reasoning: z.boolean(),
  /** Prompt caching. */
  caching: z.boolean(),
})
export type ModelInfo = z.infer<typeof ModelInfoSchema>

/** Credits of a provider account, in USD: bought and used so far. */
export const ProviderCreditsSchema = z.object({ total: z.number(), used: z.number() })
export type ProviderCredits = z.infer<typeof ProviderCreditsSchema>

export const SessionStateSchema = z.enum(['running', 'waiting', 'idle', 'ended'])
export type SessionState = z.infer<typeof SessionStateSchema>

export const SubagentInfoSchema = z.object({
  agentId: z.string(),
  agentType: z.string().nullable(),
  description: z.string().nullable().default(null),
  state: z.enum(['running', 'done']),
  /** How a `done` subagent ended when it did not complete: an error result, or killed/cancelled. */
  outcome: z.enum(['failed', 'stopped']).optional(),
  updatedAt: z.string(),
  /** When the subagent was first seen (`null` from older daemons). */
  startedAt: z.string().nullable().default(null),
  /** Tool uses in its transcript so far. */
  toolCount: z.number().int().nonnegative().default(0),
  /** The workflow run (`wf_…`) that spawned it, when it is one of a run's agents; absent otherwise. */
  workflowRunId: z.string().optional(),
  /** The run's phase it works in, as the workflow script named it; absent outside a run or until known. */
  workflowPhase: z.string().optional(),
})
export type SubagentInfo = z.infer<typeof SubagentInfoSchema>

/** Git checkout of a session's directory: the worktree root and its branch (`null` when detached). */
export const CheckoutSchema = z.object({ root: z.string(), branch: z.string().nullable() })
export type Checkout = z.infer<typeof CheckoutSchema>

/** Context window usage reported by Claude Code's status line. */
export const ContextUsageSchema = z.object({
  usedTokens: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  /** 0-100. */
  percent: z.number().min(0),
})
export type ContextUsage = z.infer<typeof ContextUsageSchema>

/** What Claude Code's status line reports for a session; unknown items are `null`, never zero. */
export const SessionStatusSchema = z.object({
  /** Display name ("Opus 5.5"). */
  model: z.string().nullable(),
  /** Reasoning effort level ("high"), only for models that support it. */
  effort: z.string().nullable(),
  context: ContextUsageSchema.nullable(),
})
export type SessionStatus = z.infer<typeof SessionStatusSchema>

/** A usage limit window of the account: percentage used and when it resets (epoch milliseconds). */
export const UsageWindowSchema = z.object({ percent: z.number().min(0), resetsAt: z.number() })
export type UsageWindow = z.infer<typeof UsageWindowSchema>

/** Usage limits of a profile's Claude account (subscribers only); `null` windows are unknown. */
export const AccountLimitsSchema = z.object({
  profileId: z.string().min(1),
  fiveHour: UsageWindowSchema.nullable(),
  sevenDay: UsageWindowSchema.nullable(),
  updatedAt: z.string(),
})
export type AccountLimits = z.infer<typeof AccountLimitsSchema>

/**
 * What a session last did, for the list's preview: its last prompt, reply or tool call as one line of
 * plain text (at most `LAST_ACTIVITY_MAX_CHARS`), with the entry's time. Never sent in push payloads.
 */
export const LastActivitySchema = z.object({
  kind: z.enum(['user', 'assistant', 'tool']),
  text: z.string(),
  at: z.string(),
})
export type LastActivity = z.infer<typeof LastActivitySchema>

export const SessionSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  /** The profile's agent; absent means Claude Code (older daemons, or an agent this parser does not know). */
  agent: wireAgentId,
  cwd: z.string(),
  title: z.string(),
  state: SessionStateSchema,
  permissionMode: PermissionModeSchema.nullable(),
  /** Codex: the approval policy (`on-request`, `never`, …); `null` for Claude Code, until known and from older daemons. */
  approvalPolicy: z.string().nullable().default(null),
  /** Codex: the permission profile (`:read-only`, `:workspace`, `:danger-full-access` or a named one); `null` for Claude Code and until known. */
  permissionProfile: z.string().nullable().default(null),
  controllable: z.boolean(),
  paneId: z.string().nullable(),
  updatedAt: z.string(),
  subagents: z.array(SubagentInfoSchema).default([]),
  backgroundTasks: z.number().int().nonnegative().default(0),
  /** `null` outside git (and from older daemons). */
  checkout: CheckoutSchema.nullable().default(null),
  /** `null` until the session's status line reports (and from older daemons). */
  status: SessionStatusSchema.nullable().default(null),
  /** `null` until the daemon reads the transcript (and from older daemons). */
  lastActivity: LastActivitySchema.nullable().default(null),
})
export type Session = z.infer<typeof SessionSchema>

/** A live session can still change files: open in tmux and not ended. */
export function isLiveSession(session: Pick<Session, 'controllable' | 'state'>): boolean {
  return session.controllable && session.state !== 'ended'
}

/** Other live sessions working in the same git checkout as `session` (none outside git). */
export function checkoutPeers<T extends Pick<Session, 'id' | 'controllable' | 'state' | 'checkout'>>(
  session: Pick<Session, 'id' | 'checkout'>,
  sessions: readonly T[],
): T[] {
  const root = session.checkout?.root
  if (!root) return []
  return sessions.filter((s) => s.id !== session.id && s.checkout?.root === root && isLiveSession(s))
}

export const CheckoutPeerSchema = z.object({ id: z.string(), title: z.string() })
export type CheckoutPeer = z.infer<typeof CheckoutPeerSchema>

/**
 * What a worktree started in a checkout inherits (Claude Code does it): the checkout's local
 * settings, when it has `.claude/settings.local.json`, and the entries of its `.worktreeinclude`.
 */
export const WorktreeCopySchema = z.object({ localSettings: z.boolean(), include: z.array(z.string()) })
export type WorktreeCopy = z.infer<typeof WorktreeCopySchema>

/** A linked git worktree a session works in (never the repository's main checkout). */
export const WorktreeInfoSchema = z.object({
  path: z.string(),
  branch: z.string().nullable(),
  /** The repository's main checkout. */
  mainRoot: z.string(),
  /** Modified or untracked files. */
  dirty: z.number().int().nonnegative(),
  /** Commits reachable from HEAD and from no remote ref (also when the branch has no upstream). */
  unpushed: z.number().int().nonnegative(),
})
export type WorktreeInfo = z.infer<typeof WorktreeInfoSchema>

/** How a file differs from `HEAD`; an untracked file is `added`. */
export const ChangeStatusSchema = z.enum(['added', 'modified', 'deleted', 'renamed'])
export type ChangeStatus = z.infer<typeof ChangeStatusSchema>

/** A file of a session's working tree that differs from `HEAD` (`changes.result`). */
export const ChangedFileSchema = z.object({
  /** Relative to the checkout root. */
  path: z.string(),
  /** `renamed` only: the path in `HEAD`. */
  oldPath: z.string().nullable(),
  status: ChangeStatusSchema,
  /** `null` when unknown (binary, or an untracked file too big to count). */
  added: z.number().int().nonnegative().nullable(),
  deleted: z.number().int().nonnegative().nullable(),
  binary: z.boolean(),
  /** A lockfile or generated output: the app starts it collapsed. */
  generated: z.boolean(),
  untracked: z.boolean(),
})
export type ChangedFile = z.infer<typeof ChangedFileSchema>

/** Lines of a file's diff per `changes.diffResult`. */
export const CHANGES_DIFF_PAGE = 2000

/**
 * What to do with a session's worktree: `delete` only when clean and pushed; `push-delete` commits
 * and pushes first; `discard-delete` throws the work away (asked twice in the app).
 */
export const WorktreeActionSchema = z.enum(['delete', 'push-delete', 'discard-delete'])
export type WorktreeAction = z.infer<typeof WorktreeActionSchema>

/** Data of the `ack` to `session.close`. */
export const CloseResultSchema = z.object({
  closed: z.enum(['exited', 'killed', 'already']),
  worktree: z.enum(['deleted', 'kept']).optional(),
})
export type CloseResult = z.infer<typeof CloseResultSchema>

/**
 * An image in the transcript, without its data (fetched with `transcript.image`). `id` locates it in
 * the transcript (opaque to the app); `bytes` is the decoded size, so oversized images can be skipped.
 */
export const ImageRefSchema = z.object({
  id: z.string().min(1),
  mediaType: z.string(),
  bytes: z.number().int().nonnegative(),
})
export type ImageRef = z.infer<typeof ImageRefSchema>

/** Largest transcript image the daemon sends to the app (decoded bytes; the Claude API limit). */
export const MAX_TRANSCRIPT_IMAGE_BYTES = 5 * 1024 * 1024

/** Absent in older daemons. */
const images = z.array(ImageRefSchema).default([])

/** A phase of a workflow run, as the script's `meta` declares it. */
export const WorkflowPhaseSchema = z.object({ title: z.string(), detail: z.string().nullable() })
export type WorkflowPhase = z.infer<typeof WorkflowPhaseSchema>

/**
 * What a `Workflow` tool call (Claude Code's multi-agent orchestration) declares about its run, read
 * from the script's `meta`; only on `tool_use` entries of that tool, absent from older daemons.
 */
export const WorkflowCallSchema = z.object({
  /** `meta.name`, or the saved workflow's name; `null` when the call only points at a script file. */
  name: z.string().nullable(),
  description: z.string().nullable(),
  phases: z.array(WorkflowPhaseSchema),
})
export type WorkflowCall = z.infer<typeof WorkflowCallSchema>

/** How a `Workflow` call's result names the run it launched; only on that result, absent from older daemons. */
export const WorkflowLaunchSchema = z.object({
  /** Claude Code's background task id, the one its task notification carries. */
  taskId: z.string().nullable(),
  /** The run id (`wf_…`); the run's agents carry it as `workflowRunId`. */
  runId: z.string().nullable(),
  /** The description echoed at launch (the only one known when the script is a file). */
  summary: z.string().nullable(),
})
export type WorkflowLaunch = z.infer<typeof WorkflowLaunchSchema>

const entryBase = {
  /** Stable unique key: `<uuid>:<index>`. */
  key: z.string(),
  /** Line number in the transcript file (0-based). */
  cursor: z.number().int().nonnegative(),
  /** Position of this entry within its line. */
  index: z.number().int().nonnegative(),
  uuid: z.string(),
  timestamp: z.string().nullable(),
  isSidechain: z.boolean(),
}

export const TranscriptEntrySchema = z.discriminatedUnion('kind', [
  /** `text` is empty when the prompt only has images. */
  z.object({ ...entryBase, kind: z.literal('user'), text: z.string(), images }),
  z.object({ ...entryBase, kind: z.literal('assistant_text'), text: z.string() }),
  z.object({ ...entryBase, kind: z.literal('thinking'), text: z.string() }),
  z.object({
    ...entryBase,
    kind: z.literal('tool_use'),
    toolUseId: z.string(),
    name: z.string(),
    input: z.record(z.string(), z.unknown()),
    /** `Workflow` calls only: what the run declares (see `WorkflowCallSchema`). */
    workflow: WorkflowCallSchema.optional(),
  }),
  z.object({
    ...entryBase,
    kind: z.literal('tool_result'),
    toolUseId: z.string(),
    content: z.string(),
    isError: z.boolean(),
    truncated: z.boolean(),
    images,
    /** The result of a `Workflow` call only: the run it launched (see `WorkflowLaunchSchema`). */
    workflow: WorkflowLaunchSchema.optional(),
  }),
  z.object({
    ...entryBase,
    kind: z.literal('system'),
    subtype: z.string(),
    text: z.string(),
    /** `turn_duration` only: lets the app write the text in its own language. */
    durationMs: z.number().optional(),
    /** `task_notification` only: `completed`, `failed`, `stopped`, `killed` or another value. */
    status: z.string().optional(),
    /** `task_notification` only: extra explanation, when Claude Code gives one. */
    note: z.string().optional(),
    /** `task_notification` only: the tool call that started the task, when the notification names it. */
    toolUseId: z.string().optional(),
    /** `task_notification` only: the task's result text, cut at 4,000 characters, when there is one. */
    result: z.string().optional(),
    /** `tagged` only: the first tag name of an entry made of tags the daemon does not know. */
    tag: z.string().optional(),
    /** `compact_boundary` only: the compaction trigger (`manual`, `auto`), when Claude Code reports one. */
    trigger: z.string().optional(),
  }),
  z.object({ ...entryBase, kind: z.literal('unknown'), raw: z.string() }),
])
export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>
export type TranscriptEntryKind = TranscriptEntry['kind']
const TRANSCRIPT_ENTRY_KINDS = [
  'user',
  'assistant_text',
  'thinking',
  'tool_use',
  'tool_result',
  'system',
  'unknown',
] as const satisfies readonly TranscriptEntryKind[]

/** Longest `transcript.search` query, in characters. */
export const MAX_TRANSCRIPT_SEARCH_QUERY = 200
/** Most hits one `transcript.search` page carries. */
export const TRANSCRIPT_SEARCH_LIMIT = 50
/** Longest snippet of a search hit, in characters. */
export const TRANSCRIPT_SEARCH_SNIPPET_CHARS = 160

/** A `transcript.search` hit: the entry, and the text around the first matched word for the list. */
export const TranscriptSearchHitSchema = z.object({
  sessionId: z.string(),
  /** The matched entry's `key`, `cursor`, `index` and `kind`: enough to open the session at it. */
  key: z.string(),
  cursor: z.number().int().nonnegative(),
  index: z.number().int().nonnegative(),
  kind: z.enum(TRANSCRIPT_ENTRY_KINDS),
  timestamp: z.string().nullable(),
  /** At most `TRANSCRIPT_SEARCH_SNIPPET_CHARS` of the entry's searchable text around the first match. */
  snippet: z.string(),
  /** The snippet starts / ends inside the text (the app draws an ellipsis there). */
  cutStart: z.boolean(),
  cutEnd: z.boolean(),
  /** Matched words inside `snippet`, as `[start, end)` offsets in UTF-16 code units, for highlighting. */
  ranges: z.array(z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() })),
})
export type TranscriptSearchHit = z.infer<typeof TranscriptSearchHitSchema>

export const RuleScopeSchema = z.enum(['profile', 'project'])
export type RuleScope = z.infer<typeof RuleScopeSchema>

/**
 * An always-allow rule of a settings file: `app` when a device created it ("allow always", in the
 * daemon's rules log, undone by `ruleId`), `hand` when it was written on the computer.
 */
export const ListedRuleSchema = z.discriminatedUnion('origin', [
  z.object({ origin: z.literal('app'), rule: z.string(), ruleId: z.string(), createdAt: z.string() }),
  z.object({ origin: z.literal('hand'), rule: z.string() }),
])
export type ListedRule = z.infer<typeof ListedRuleSchema>

/** A settings file with always-allow rules: a profile's `settings.json` or a project's `settings.local.json`. */
export const RuleFileSchema = z.object({
  /** Absolute path; `rules.delete` only accepts a path the daemon listed. */
  file: z.string(),
  scope: RuleScopeSchema,
  /** Scope `profile`: the profile the file belongs to. */
  profileId: z.string().nullable(),
  /** Scope `project`: the project folder. */
  project: z.string().nullable(),
  rules: z.array(ListedRuleSchema),
})
export type RuleFile = z.infer<typeof RuleFileSchema>

/** Most entries `approvals.result` carries. */
export const APPROVALS_LIST_LIMIT = 500

/** What an approval log entry records. */
export const ApprovalActionSchema = z.enum(['allow', 'deny', 'undo', 'delete'])
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>

/**
 * One entry of the daemon's approval log: a decision answered from a device or a rule undone or
 * deleted. `target` is the live status's short sanitized target; never the tool input.
 */
export const ApprovalEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  action: ApprovalActionSchema,
  /** An `allow` that also created an always-allow rule. */
  always: z.boolean().optional(),
  /** `null` when the action came from the computer (CLI). */
  device: z.object({ id: z.string(), name: z.string() }).nullable(),
  sessionId: z.string().nullable(),
  /** Base name of the session's folder. */
  folder: z.string().nullable(),
  tool: z.string().nullable(),
  target: z.string().nullable(),
  /** Rule actions and an `always` allow: the rule text (it is in the settings file anyway). */
  rule: z.string().nullable(),
  /** The rules log ID of that rule, for undo. */
  ruleId: z.string().nullable(),
})
export type ApprovalEntry = z.infer<typeof ApprovalEntrySchema>

/** Platform of a paired phone; picks the push payload block (APNs or Android). */
export const DevicePlatformSchema = z.enum(['ios', 'android'])
export type DevicePlatform = z.infer<typeof DevicePlatformSchema>

/** A device paired with the daemon, as `devices.list` shows it (times as ISO strings). */
export const PairedDeviceInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.string(),
  pairedAt: z.string(),
  lastSeen: z.string().nullable(),
  /** The device that asked. */
  current: z.boolean(),
})
export type PairedDeviceInfo = z.infer<typeof PairedDeviceInfoSchema>

/** Where devices reach the daemon: direct `host:port` addresses and the home connection relay. */
export const DaemonPathsSchema = z.object({
  addresses: z.array(z.string()),
  /** The home relay (`wss://…`), null while the daemon has none (off, or none answers). */
  relay: z.string().nullable(),
  /** The relays the daemon may use, to find it when its home relay changed. */
  relays: z.array(z.string()),
})
export type DaemonPaths = z.infer<typeof DaemonPathsSchema>

/**
 * Where a daemon without a Firebase service account sends this phone's pushes: the push relay and
 * the grant it issued to the app (the FCM token, sealed; only the relay can open it).
 */
export const PushRelaySchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  grant: z.string().min(1).max(16_384),
})
export type PushRelay = z.infer<typeof PushRelaySchema>

/**
 * How the daemon sends pushes: straight to FCM with a Firebase service account (`firebase`), through
 * the push relay with each phone's grant (`relay`), or not at all (`off`).
 */
export const PushModeSchema = z.enum(['firebase', 'relay', 'off'])
export type PushMode = z.infer<typeof PushModeSchema>

export const PushTestResultSchema = z.enum(['sent', 'off', 'unregistered', 'failed'])
export type PushTestResult = z.infer<typeof PushTestResultSchema>

/** States of a session's live status (Live Activity / Android notification). */
export const LiveStateSchema = z.enum(['working', 'waiting', 'done', 'closed'])
export type LiveState = z.infer<typeof LiveStateSchema>

/** Name the app passes to `createLiveActivity` and the daemon puts in `content-state.name`. */
export const LIVE_ACTIVITY_NAME = 'SessionActivity'

const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/)

/**
 * App theme colors the live status is drawn with. The app sends them when it registers; the daemon
 * echoes them in every update, since the widget cannot read the app's theme.
 */
export const LivePaletteSchema = z.object({
  background: HexColorSchema,
  text: HexColorSchema,
  textMuted: HexColorSchema,
  /** Working state. */
  accent: HexColorSchema,
  /** Done state. */
  success: HexColorSchema,
  /** Waiting state. */
  warning: HexColorSchema,
})
export type LivePalette = z.infer<typeof LivePaletteSchema>

/**
 * Props of the live status, rendered as they are by the widget (it cannot translate): texts arrive
 * already translated. Besides the session title and folder, never session content: names, state,
 * step categories with tool names, the current tool's target sanitized by the daemon (a file's base
 * name, a command's program), counts, times. Fields after `startedAt` have defaults because older
 * daemons do not send them.
 */
/** The tool permission a live status waits for, answerable from the lock screen; labels already translated. */
export const LivePendingSchema = z.object({
  requestId: z.string(),
  tool: z.string(),
  allow: z.string(),
  deny: z.string(),
})
export type LivePending = z.infer<typeof LivePendingSchema>

/** Items of the session's todo list completed so far, out of `total` (at least 1). */
export const LiveProgressSchema = z.object({
  done: z.number().int().nonnegative(),
  total: z.number().int().positive(),
})
export type LiveProgress = z.infer<typeof LiveProgressSchema>

/** The progress as the live status shows it: `☑ 3/7`. */
export function liveProgressText(progress: LiveProgress | null): string {
  return progress ? `☑ ${progress.done}/${progress.total}` : ''
}

/** Short translated words the card shows around its timers and on the Open button. */
export const LiveLabelsSchema = z.object({
  working: z.string(),
  waiting: z.string(),
  total: z.string(),
  notified: z.string(),
  finished: z.string(),
  open: z.string(),
})
export type LiveLabels = z.infer<typeof LiveLabelsSchema>

/** Longest current task (opt-in) sent with the live status. */
export const LIVE_TASK_MAX = 48

export const LiveStatusPropsSchema = z.object({
  /** Profile name. */
  title: z.string(),
  state: LiveStateSchema,
  status: z.string(),
  /** Translated step category ("running a command"), empty when none. */
  step: z.string(),
  /** Translated tool count ("3 tools"), empty when none. */
  tools: z.string(),
  /** Start of the turn, epoch milliseconds (drives the elapsed timer). */
  startedAt: z.number(),
  /** Name of the daemon's computer, empty when unknown. */
  host: z.string().default(''),
  /** Session title. */
  session: z.string().default(''),
  /** Session folder, home shortened to `~`. */
  path: z.string().default(''),
  /** Latest steps of the turn, newest first, translated ("Bash · running a command"). */
  recent: z.array(z.string()).default([]),
  /** Translated "time ago" template with a `{time}` placeholder ("{time} ago"). */
  ago: z.string().default(''),
  /** When the state last changed, epoch milliseconds (0 when unknown). */
  changedAt: z.number().default(0),
  /** End of the turn (done or closed), epoch milliseconds: the elapsed timer stops there. */
  endedAt: z.number().nullable().default(null),
  /** Glyphs of the last five steps, newest first (`⌘` command, `✎` edit, `⌕` search, `⇄` web, `⌥` subagent, `?` permission, `·` other). */
  glyphs: z.array(z.string()).default([]),
  /** The tool permission the session waits for, with its translated button labels; `null` otherwise. */
  pending: LivePendingSchema.nullable().default(null),
  /** Short translated line: "total" when done, "transcript kept · resume from the app" when closed. */
  hint: z.string().default(''),
  /** Translated counts of the running subagents and background tasks ("2 subagents · 1 background task"), empty when none. */
  tasks: z.string().default(''),
  /** The step running now: tool and sanitized short target ("Bash · pnpm test", "Edit · app.ts"), empty when none. */
  current: z.string().default(''),
  /** Progress of the session's todo list, `null` without one. */
  progress: LiveProgressSchema.nullable().default(null),
  /** What the session is doing, as a translated phrase from the daemon's fixed table ("Running tests…"), empty when none. */
  activity: z.string().default(''),
  /** The in-progress todo item (opt-in, at most LIVE_TASK_MAX characters), empty otherwise. */
  task: z.string().default(''),
  /** When this update was sent, epoch milliseconds (0 when unknown). */
  notifiedAt: z.number().default(0),
  /** Deep link that opens the session (`claude-remote://session/<id>`), empty when unknown. */
  link: z.string().default(''),
  /** Translated labels of the card, `null` from older senders (the card then shows none). */
  labels: LiveLabelsSchema.nullable().default(null),
  /** Theme colors of the app that registered; absent from older daemons (the widget uses dark). */
  palette: LivePaletteSchema.optional(),
  /** The session's agent, so the card shows its badge; absent from older daemons, and an unknown id reads as absent (the app mark). */
  agent: wireAgentId,
})
export type LiveStatusProps = z.infer<typeof LiveStatusPropsSchema>

/**
 * A turn's duration in words for the done state: seconds under a minute ("40 s"), whole minutes
 * under an hour ("12 min"), hours and minutes past it ("1 h 05 min", "2 h"). Same in every language.
 */
export function liveTurnDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  if (total < 60) return `${total} s`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} h ${rest < 10 ? `0${rest}` : rest} min` : `${hours} h`
}

/**
 * How the daemon reaches one phone with the live status of the sessions it follows: the FCM token
 * (and its relay grant), and on iOS 17.2+ the push-to-start token with the relay grant that seals it.
 */
export const LiveFollowDeviceSchema = z.object({
  platform: DevicePlatformSchema,
  fcmToken: z.string().min(1),
  relay: PushRelaySchema.optional(),
  /** iOS push-to-start token (hex): lets the daemon start a Live Activity while the app is closed. */
  startToken: z.string().min(1).optional(),
  /** Relay grant sealing `startToken`, for daemons without a service account. */
  startRelay: PushRelaySchema.optional(),
  palette: LivePaletteSchema.optional(),
  /** Android: the app draws the live status itself from data messages. */
  androidDataMessages: z.boolean().optional(),
  /** Show the in-progress todo item on the lock screen (opt-in). */
  showTask: z.boolean().optional(),
})
export type LiveFollowDevice = z.infer<typeof LiveFollowDeviceSchema>

/**
 * Android live status sent as an FCM data message (`data.live`, JSON) to apps that draw the
 * notification themselves: `end` leaves a notification that can be swiped away.
 */
export const LiveDataMessageSchema = z.object({
  event: z.enum(['update', 'end']),
  props: LiveStatusPropsSchema,
})
export type LiveDataMessage = z.infer<typeof LiveDataMessageSchema>

/**
 * Title and body of the Android live status notification: "<agent> · <session> · <state>" (the
 * agent's name when the props carry one), then the current task or the phrase, the current step
 * (else the step category), the progress, the counts and the glyph row (oldest → newest). The same
 * text whether the system or the app draws it.
 */
export function liveNotificationText(props: LiveStatusProps): { title: string; body: string } {
  const glyphs = [...props.glyphs].reverse().join(' ')
  const title = [props.agent ? AGENT_LABELS[props.agent] : '', props.session || props.title, props.status]
    .filter(Boolean)
    .join(' · ')
  const details = [
    props.task || props.activity,
    props.current || props.step,
    liveProgressText(props.progress),
    props.tasks,
    props.tools,
    glyphs,
  ]
    .filter(Boolean)
    .join(' · ')
  return { title, body: details || props.status }
}

export const QuestionKindSchema = z.enum(['choice', 'text', 'number'])
export type QuestionKind = z.infer<typeof QuestionKindSchema>

export const QuestionSchema = z.object({
  question: z.string(),
  header: z.string().nullable(),
  kind: QuestionKindSchema,
  options: z.array(z.object({ label: z.string(), description: z.string().nullable() })),
  multiSelect: z.boolean(),
})
export type Question = z.infer<typeof QuestionSchema>

/** Structured content of a request Claude Code shows as a menu (`AskUserQuestion`, `ExitPlanMode`). */
export const PermissionInteractionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('question'), title: z.string().nullable(), questions: z.array(QuestionSchema) }),
  z.object({ kind: z.literal('plan'), plan: z.string().nullable() }),
])
export type PermissionInteraction = z.infer<typeof PermissionInteractionSchema>

/** Leaving plan mode never offers `auto` or `bypassPermissions`. */
export const PlanDecisionSchema = z.enum(['acceptEdits', 'default', 'keepPlanning'])
export type PlanDecision = z.infer<typeof PlanDecisionSchema>

export const PermissionAnswerSchema = z.discriminatedUnion('kind', [
  /** Question text → answer; multiple choices already joined with ", ". */
  z.object({ kind: z.literal('question'), answers: z.record(z.string(), z.string()) }),
  z.object({ kind: z.literal('plan'), decision: PlanDecisionSchema, feedback: z.string().optional() }),
])
export type PermissionAnswer = z.infer<typeof PermissionAnswerSchema>

export const PermissionRequestInfoSchema = z.object({
  requestId: z.string(),
  sessionId: z.string(),
  profileId: z.string(),
  tool: z.string(),
  input: z.record(z.string(), z.unknown()),
  suggestedRule: z.string().nullable(),
  /** The agent accepts always-allow rules with the answer (false for Codex); older daemons: true. */
  rules: z.boolean().default(true),
  defaultScope: RuleScopeSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
  interaction: PermissionInteractionSchema.optional(),
  /**
   * The hook stopped waiting (timeout, or closed by the agent) while the agent's own dialog may
   * still be open: answer it in the terminal. Resolved when the session moves on.
   */
  terminal: z.boolean().optional(),
})
export type PermissionRequestInfo = z.infer<typeof PermissionRequestInfoSchema>

export const PermissionOutcomeSchema = z.enum(['allowed', 'denied', 'expired', 'cancelled'])
export type PermissionOutcome = z.infer<typeof PermissionOutcomeSchema>

export const CommandSourceSchema = z.enum(['builtin', 'profile', 'project', 'plugin'])
export type CommandSource = z.infer<typeof CommandSourceSchema>

export const CommandItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  source: CommandSourceSchema,
  interactive: z.boolean().default(false),
})
export type CommandItem = z.infer<typeof CommandItemSchema>

export const FileItemSchema = z.object({ path: z.string(), kind: z.enum(['file', 'dir']) })
export type FileItem = z.infer<typeof FileItemSchema>

/** A recent directory of a profile, with the branch of its latest session and the sessions used there this week. */
export const ProjectItemSchema = z.object({
  cwd: z.string(),
  lastUsedAt: z.string(),
  branch: z.string().nullable().default(null),
  sessions: z.number().int().nonnegative().default(0),
})
export type ProjectItem = z.infer<typeof ProjectItemSchema>

/** A subdirectory listed by `directories.list`; `git` when it holds a `.git` directory or file. */
export const DirectoryItemSchema = z.object({ name: z.string(), path: z.string(), git: z.boolean() })
export type DirectoryItem = z.infer<typeof DirectoryItemSchema>
/** Default and maximum number of items in `directories.results`. */
export const DIRECTORY_LIST_LIMIT = 200
export const MAX_DIRECTORY_LIST_LIMIT = 500

/** Longest name a session can be given when it starts. */
export const SESSION_NAME_MAX = 80
/** A session's display name: trimmed, one line, no control characters. */
export const SessionNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(SESSION_NAME_MAX)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is rejected.
  .refine((name) => !/[\u0000-\u001f\u007f]/.test(name), 'the name must be a single line')

export const MuteStateSchema = z.object({
  profiles: z.array(z.string()).default([]),
  sessions: z.array(z.string()).default([]),
})
export type MuteState = z.infer<typeof MuteStateSchema>

/** Image types Claude accepts; the daemon also checks the bytes against the declared type. */
export const ATTACHMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const AttachmentMimeTypeSchema = z.enum(ATTACHMENT_MIME_TYPES)
export type AttachmentMimeType = z.infer<typeof AttachmentMimeTypeSchema>
/** Images per prompt. */
export const MAX_ATTACHMENTS = 4

/** How `session.input` is delivered: right away, held in the queue, or held only while the session is busy. */
export const InputModeSchema = z.enum(['now', 'queue', 'auto'])
export type InputMode = z.infer<typeof InputModeSchema>
export const InputDeliverySchema = z.enum(['sent', 'queued'])
export type InputDelivery = z.infer<typeof InputDeliverySchema>

/** A prompt waiting for the session to be free; delivered in order once the turn ends. */
export const QueuedMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  text: z.string(),
  attachmentIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  /** Why the last delivery failed; the prompt then waits for the user (edit, send now, remove). */
  error: z.string().nullable().default(null),
})
export type QueuedMessage = z.infer<typeof QueuedMessageSchema>
/** Queued prompts per session. */
export const MAX_QUEUE = 20
/** Decoded bytes per image (the Claude API limit). */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

// --- Scheduled prompts (#432) ---------------------------------------------------------------------

export const SCHEDULE_TITLE_MAX = 60
/** Same cap as a first prompt at start, which a scheduled prompt often is. */
export const SCHEDULE_PROMPT_MAX = 8_000

/** Where a schedule's prompt goes: an existing session, or a new one started with it as its first prompt. */
export const ScheduleTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('session'), sessionId: z.string().min(1) }),
  z.object({
    kind: z.literal('new'),
    profileId: z.string().min(1),
    cwd: z.string().min(1),
    /** Start in an isolated copy (git worktree), like the New session screen's switch. */
    worktree: z.boolean().default(false),
    name: SessionNameSchema.optional(),
  }),
])
export type ScheduleTarget = z.infer<typeof ScheduleTargetSchema>

/** A time of day on the computer's clock, `HH:MM`. */
export const ScheduleTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time as HH:MM')

/** When a schedule runs: once at an instant, or every day at a time on some weekdays. */
export const ScheduleWhenSchema = z.discriminatedUnion('kind', [
  /** One run at an instant (ISO 8601 with its offset); the computer's clock decides when that is. */
  z.object({
    kind: z.literal('once'),
    at: z.string().refine((value) => Number.isFinite(Date.parse(value)), 'an ISO date-time'),
  }),
  /** At `time` (computer local time) on `days` (0 = Sunday … 6 = Saturday; none = every day). */
  z.object({
    kind: z.literal('repeat'),
    time: ScheduleTimeSchema,
    days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  }),
])
export type ScheduleWhen = z.infer<typeof ScheduleWhenSchema>

/** What a run did: delivered to a free session, queued in a busy one, started a session, failed, or was missed. */
export const ScheduleOutcomeSchema = z.enum(['sent', 'queued', 'started', 'failed', 'missed'])
export type ScheduleOutcome = z.infer<typeof ScheduleOutcomeSchema>

export const ScheduleRunSchema = z.object({
  at: z.string(),
  outcome: ScheduleOutcomeSchema,
  /** Why the run failed. */
  error: z.string().nullable().default(null),
  /** The session the prompt went to, or the one started. */
  sessionId: z.string().nullable().default(null),
})
export type ScheduleRun = z.infer<typeof ScheduleRunSchema>

/** What the app sends to create a schedule or replace one. */
export const ScheduleInputSchema = z.object({
  title: z.string().trim().min(1).max(SCHEDULE_TITLE_MAX),
  prompt: z.string().trim().min(1).max(SCHEDULE_PROMPT_MAX),
  target: ScheduleTargetSchema,
  when: ScheduleWhenSchema,
  enabled: z.boolean().default(true),
})
export type ScheduleInput = z.infer<typeof ScheduleInputSchema>

/** A schedule as the daemon keeps and reports it. */
export const ScheduleSchema = ScheduleInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastRun: ScheduleRunSchema.nullable().default(null),
  /** Its next run (ISO), computed by the daemon; `null` while disabled or once it is spent. */
  nextRunAt: z.string().nullable().default(null),
})
export type Schedule = z.infer<typeof ScheduleSchema>

/** Keys the app may send to a session. Anything else is rejected by the daemon. */
export const ALLOWED_KEYS = [
  'Enter',
  'Escape',
  'Up',
  'Down',
  'Left',
  'Right',
  'Tab',
  'BTab',
  'C-c',
  'C-d',
  'Space',
  'BSpace',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
] as const
export const KeySchema = z.enum(ALLOWED_KEYS)
export type Key = z.infer<typeof KeySchema>

export const ErrorCodeSchema = z.enum([
  'bad_request',
  'unknown_type',
  'unauthorized',
  'protocol_mismatch',
  'not_found',
  'not_controllable',
  'invalid_key',
  'too_large',
  'unsupported_media',
  'already_resolved',
  'mode_forbidden',
  'mode_unreachable',
  'session_busy',
  'invalid_cwd',
  /** Shell commands are off in the daemon config (`remote-harness commands on`). */
  'commands_disabled',
  'internal',
])
export type ErrorCode = z.infer<typeof ErrorCodeSchema>

/** Longest shell command `command.run` accepts. */
export const MAX_COMMAND_LENGTH = 4000
/** Where a chunk of a shell command's output came from. */
export const CommandStreamSchema = z.enum(['stdout', 'stderr'])
export type CommandStream = z.infer<typeof CommandStreamSchema>
/**
 * Why a shell command ended: it exited by itself, was cancelled, ran past the timeout, passed the
 * output cap, or the shell could not start.
 */
export const CommandEndReasonSchema = z.enum(['exited', 'cancelled', 'timeout', 'output_limit', 'failed'])
export type CommandEndReason = z.infer<typeof CommandEndReasonSchema>

/** A request the daemon rejected, for `diagnostics.result`: never its payload or message. */
export const RejectedRequestSchema = z.object({
  at: z.string(),
  type: z.string().max(64),
  code: ErrorCodeSchema,
})
export type RejectedRequest = z.infer<typeof RejectedRequestSchema>
/** How many rejections the daemon keeps for `diagnostics.errors`. */
export const DIAGNOSTICS_LIMIT = 50

/** Branches the daemon's installer can follow: `main` (stable) or `development`. */
export const DaemonUpdateChannelSchema = z.enum(['main', 'development'])
export type DaemonUpdateChannel = z.infer<typeof DaemonUpdateChannelSchema>

/** Steps of a daemon update run; `done` and `failed` are final. */
export const DaemonUpdateStepSchema = z.enum(['fetching', 'building', 'restarting', 'done', 'failed'])
export type DaemonUpdateStep = z.infer<typeof DaemonUpdateStepSchema>

/** One `remote-harness update` run, wherever it was started (app, tray, terminal). */
export const DaemonUpdateRunSchema = z.object({
  channel: DaemonUpdateChannelSchema,
  /** Version that was running when the run started. */
  from: z.string(),
  /** Version installed (known once fetched; the running one when done). */
  to: z.string().nullable(),
  commit: z.string().nullable(),
  step: DaemonUpdateStepSchema,
  error: z.string().optional(),
  /** The build failed and the previous version was rebuilt. */
  rolledBack: z.boolean().optional(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
})
export type DaemonUpdateRun = z.infer<typeof DaemonUpdateRunSchema>

/** Why this daemon cannot update itself: run from sources, a development clone, no service manager. */
export const DaemonUpdateBlockerSchema = z.enum(['not-built', 'not-installer', 'no-service'])
export type DaemonUpdateBlocker = z.infer<typeof DaemonUpdateBlockerSchema>

export const DaemonUpdateInfoSchema = z.object({
  current: z.string(),
  channel: DaemonUpdateChannelSchema,
  checkedAt: z.string().nullable(),
  checking: z.boolean(),
  available: z
    .object({ version: z.string().nullable(), commit: z.string(), downgrade: z.boolean() })
    .nullable(),
  blocked: DaemonUpdateBlockerSchema.nullable(),
  /** A session is running or waiting, or a permission is pending (the restart interrupts the app). */
  busy: z.boolean(),
  run: DaemonUpdateRunSchema.nullable(),
})
export type DaemonUpdateInfo = z.infer<typeof DaemonUpdateInfoSchema>

/** A system permission's status, shared by the phone side and the computer side of the Permissions screen. */
export const PermissionStatusSchema = z.enum(['allowed', 'denied', 'not_asked', 'limited', 'not_available'])
export type PermissionStatus = z.infer<typeof PermissionStatusSchema>

/** Computer-side rows reported by `machine.permissions`. */
export const MachinePermissionIdSchema = z.enum([
  'folderAccess',
  'fullDiskAccess',
  'accessibility',
  'desktopNotifications',
  'keychain',
])
export type MachinePermissionId = z.infer<typeof MachinePermissionIdSchema>

export const MachinePermissionEntrySchema = z.object({ path: z.string(), status: PermissionStatusSchema })
export type MachinePermissionEntry = z.infer<typeof MachinePermissionEntrySchema>

/** `entries` is only present on `folderAccess`: one per folder the daemon checked. */
export const MachinePermissionSchema = z.object({
  id: MachinePermissionIdSchema,
  status: PermissionStatusSchema,
  entries: z.array(MachinePermissionEntrySchema).optional(),
})
export type MachinePermission = z.infer<typeof MachinePermissionSchema>

/** `x-apple.systempreferences:` panes `machine.openSettingsPane` can open on the computer. */
export const SettingsPaneSchema = z.enum(['fullDiskAccess', 'accessibility'])
export type SettingsPane = z.infer<typeof SettingsPaneSchema>
