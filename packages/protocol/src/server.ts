import { z } from 'zod'
import {
  AccountLimitsSchema,
  ApprovalEntrySchema,
  ChangedFileSchema,
  CheckoutPeerSchema,
  CheckoutSchema,
  CommandEndReasonSchema,
  CommandItemSchema,
  CommandStreamSchema,
  DaemonPathsSchema,
  DaemonUpdateChannelSchema,
  DaemonUpdateInfoSchema,
  DirectoryItemSchema,
  ErrorCodeSchema,
  FileItemSchema,
  MachinePermissionSchema,
  ModelInfoSchema,
  MuteStateSchema,
  PairedDeviceInfoSchema,
  PermissionModeSchema,
  PermissionOutcomeSchema,
  PermissionRequestInfoSchema,
  ProjectItemSchema,
  ProviderCreditsSchema,
  PushModeSchema,
  PushTestResultSchema,
  QueuedMessageSchema,
  RejectedRequestSchema,
  RuleFileSchema,
  RuleScopeSchema,
  SessionSchema,
  SessionStateSchema,
  SubagentInfoSchema,
  TranscriptEntrySchema,
  WireProfileSchema,
  WorktreeCopySchema,
  WorktreeInfoSchema,
} from './domain.ts'

const replyTo = z.string().optional()

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auth.ok'),
    replyTo,
    protocolVersion: z.number().int(),
    daemonVersion: z.string(),
    /** Name of the daemon's computer (absent in older daemons). */
    host: z.string().optional(),
    profiles: z.array(WireProfileSchema),
    defaultRuleScope: RuleScopeSchema,
    muted: MuteStateSchema,
    /** Absent in older daemons. */
    push: z.object({ mode: PushModeSchema }).optional(),
    /** Present when the daemon accepts `daemon.update.*` (absent in older daemons). */
    update: z.object({ channel: DaemonUpdateChannelSchema }).optional(),
    /** Present when the daemon accepts `live.follow` and the other follow messages. */
    live: z.object({ follow: z.boolean() }).optional(),
    /** Present when the daemon accepts `command.run`; `enabled` is its config's opt-in. */
    commands: z.object({ enabled: z.boolean() }).optional(),
    /** Where to reach this daemon (direct addresses, home relay); `daemon.paths` follows changes. */
    paths: DaemonPathsSchema.optional(),
  }),
  /** The paths changed (an address, or the home relay moved). */
  z.object({ type: z.literal('daemon.paths'), ...DaemonPathsSchema.shape }),
  z.object({ type: z.literal('devices.result'), replyTo, devices: z.array(PairedDeviceInfoSchema) }),
  /** Reply to `pairing.create`: a single-use code and when it expires (ISO). */
  z.object({ type: z.literal('pairing.code'), replyTo, url: z.string(), expiresAt: z.string() }),
  /** Reply to the follow messages: what this phone follows. */
  z.object({
    type: z.literal('live.followed'),
    replyTo,
    sessionIds: z.array(z.string()),
    autoFollowProfiles: z.array(z.string()),
  }),
  z.object({ type: z.literal('pong'), replyTo }),
  z.object({ type: z.literal('ack'), replyTo, data: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('error'), replyTo, code: ErrorCodeSchema, message: z.string() }),
  z.object({ type: z.literal('sessions.snapshot'), replyTo, sessions: z.array(SessionSchema) }),
  /** A session the client may not know yet, in full. */
  z.object({ type: z.literal('session.updated'), session: SessionSchema }),
  /**
   * Only the fields that changed since the last `session.updated` / `session.changed` of that
   * session: `set` merges into it (then validated as a whole), `unset` removes optional fields.
   */
  z.object({
    type: z.literal('session.changed'),
    sessionId: z.string(),
    set: z.record(z.string(), z.unknown()),
    unset: z.array(z.string()).default([]),
  }),
  z.object({ type: z.literal('session.removed'), sessionId: z.string() }),
  /** Reply to `session.start`; `sessionId` is `null` until the pane's `SessionStart` hook registers it. */
  z.object({
    type: z.literal('session.started'),
    replyTo,
    paneId: z.string(),
    sessionId: z.string().nullable(),
  }),
  z.object({
    type: z.literal('session.state'),
    sessionId: z.string(),
    state: SessionStateSchema,
    permissionMode: PermissionModeSchema.nullable(),
  }),
  /** The new entries of one read of the transcript, in order (each carries its cursor). */
  z.object({
    type: z.literal('transcript.entries'),
    sessionId: z.string(),
    agentId: z.string().optional(),
    entries: z.array(TranscriptEntrySchema),
  }),
  z.object({
    type: z.literal('transcript.page'),
    replyTo,
    sessionId: z.string(),
    agentId: z.string().optional(),
    entries: z.array(TranscriptEntrySchema),
    hasMore: z.boolean(),
    /** Total number of lines known for the transcript when the page was built. */
    lineCount: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('pane.frame'),
    sessionId: z.string(),
    text: z.string(),
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
  }),
  /**
   * The lines that changed since the last frame or diff of that pane (`[index, text]`), and its new
   * line count; applied to the last frame (`applyPaneDiff`).
   */
  z.object({
    type: z.literal('pane.diff'),
    sessionId: z.string(),
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
    lineCount: z.number().int().nonnegative(),
    /** Lines the screen scrolled up by first (a growing log). */
    scroll: z.number().int().nonnegative().optional(),
    lines: z.array(z.tuple([z.number().int().nonnegative(), z.string()])),
  }),
  z.object({ type: z.literal('permission.request'), request: PermissionRequestInfoSchema }),
  /** Reply to `permissions.list`: every request waiting now (the same ones `permission.request` sent). */
  z.object({
    type: z.literal('permissions.result'),
    replyTo,
    requests: z.array(PermissionRequestInfoSchema),
  }),
  /** Reply to `rules.list`: the settings files that hold always-allow rules, one entry per file. */
  z.object({ type: z.literal('rules.result'), replyTo, files: z.array(RuleFileSchema) }),
  /** Reply to `approvals.list`: most recent first, at most `APPROVALS_LIST_LIMIT`. */
  z.object({ type: z.literal('approvals.result'), replyTo, entries: z.array(ApprovalEntrySchema) }),
  z.object({
    type: z.literal('permission.resolved'),
    requestId: z.string(),
    sessionId: z.string(),
    outcome: PermissionOutcomeSchema,
  }),
  z.object({ type: z.literal('subagent.updated'), sessionId: z.string(), subagent: SubagentInfoSchema }),
  /** A session's queued prompts, in delivery order; sent on every change and replayed on connect. */
  z.object({ type: z.literal('session.queue'), sessionId: z.string(), items: z.array(QueuedMessageSchema) }),
  z.object({ type: z.literal('attachment.uploaded'), replyTo, attachmentId: z.string().min(1) }),
  z.object({
    type: z.literal('transcript.image'),
    replyTo,
    imageId: z.string(),
    mediaType: z.string(),
    /** Base64, at most `MAX_TRANSCRIPT_IMAGE_BYTES` decoded. */
    data: z.string(),
  }),
  z.object({ type: z.literal('files.results'), replyTo, query: z.string(), items: z.array(FileItemSchema) }),
  z.object({ type: z.literal('commands.results'), replyTo, items: z.array(CommandItemSchema) }),
  z.object({ type: z.literal('projects.results'), replyTo, items: z.array(ProjectItemSchema) }),
  z.object({
    type: z.literal('models.results'),
    replyTo,
    profileId: z.string(),
    models: z.array(ModelInfoSchema),
    /** When the list was fetched from the provider. */
    fetchedAt: z.string(),
    /** The provider could not be reached and this is the last list fetched. */
    stale: z.boolean(),
  }),
  z.object({
    type: z.literal('provider.info'),
    replyTo,
    profileId: z.string(),
    /** A provider key is stored on the computer for this profile (the key itself never travels). */
    hasKey: z.boolean(),
    /** `null` without a key or when the provider did not answer. */
    credits: ProviderCreditsSchema.nullable(),
  }),
  z.object({
    type: z.literal('voice.polish.result'),
    replyTo,
    text: z.string(),
    /** `false` when polishing was unsupported, failed, timed out, or left the text unchanged. */
    applied: z.boolean(),
  }),
  z.object({
    type: z.literal('diagnostics.result'),
    replyTo,
    daemonVersion: z.string(),
    /** Most recent first, at most `DIAGNOSTICS_LIMIT`. */
    errors: z.array(RejectedRequestSchema),
  }),
  z.object({
    type: z.literal('directories.results'),
    replyTo,
    /** Absolute path that was listed. */
    path: z.string(),
    /** `null` at the home folder: the listing never goes above it. */
    parent: z.string().nullable(),
    home: z.string(),
    items: z.array(DirectoryItemSchema),
    /** More entries matched than `limit`. */
    truncated: z.boolean(),
  }),
  z.object({
    type: z.literal('checkout.info'),
    replyTo,
    checkout: CheckoutSchema.nullable(),
    peers: z.array(CheckoutPeerSchema),
    /** Inside a checkout: what an isolated copy (worktree) would inherit. */
    worktreeCopy: WorktreeCopySchema.optional(),
  }),
  /** Reply to `changes.list`; `root: null` when the session's folder is outside git. */
  z.object({
    type: z.literal('changes.result'),
    replyTo,
    root: z.string().nullable(),
    branch: z.string().nullable(),
    files: z.array(ChangedFileSchema),
    /** `origin`'s URL without credentials; `null` without an `origin`. */
    remote: z.string().nullable(),
    /** The branch `origin/HEAD` points to; `null` when unknown. */
    defaultBranch: z.string().nullable(),
    /** Commits reachable from HEAD and from no remote ref. */
    unpushed: z.number().int().nonnegative(),
    /** `gh` is installed: Open PR uses it, else the app offers the compare link. */
    gh: z.boolean(),
  }),
  z.object({
    type: z.literal('changes.committed'),
    replyTo,
    commit: z.string(),
    branch: z.string().nullable(),
  }),
  /** `compareUrl`: GitHub's "compare & open PR" page when `origin` is on GitHub. */
  z.object({
    type: z.literal('changes.pushed'),
    replyTo,
    branch: z.string(),
    compareUrl: z.string().nullable(),
  }),
  z.object({ type: z.literal('changes.prOpened'), replyTo, url: z.string() }),
  z.object({ type: z.literal('changes.generated'), replyTo, title: z.string(), body: z.string() }),
  /** Reply to `changes.diff`: unified diff lines from `offset`, at most `CHANGES_DIFF_PAGE`. */
  z.object({
    type: z.literal('changes.diffResult'),
    replyTo,
    path: z.string(),
    offset: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    lines: z.array(z.string()),
    binary: z.boolean(),
  }),
  /** `null` when the session's folder is not inside a linked git worktree. */
  z.object({ type: z.literal('worktree.info'), replyTo, worktree: WorktreeInfoSchema.nullable() }),
  z.object({ type: z.literal('mute.updated'), muted: MuteStateSchema }),
  /** Reply to `daemon.update.check` / `start`, and broadcast whenever an update run changes. */
  z.object({ type: z.literal('daemon.update.info'), replyTo, info: DaemonUpdateInfoSchema }),
  z.object({ type: z.literal('push.testResult'), replyTo, result: PushTestResultSchema }),
  /** Usage limits of a profile's account; sent when they change and to every client that connects. */
  z.object({ type: z.literal('limits.updated'), limits: AccountLimitsSchema }),
  /** Reply to `command.run`: the run's id and the folder it runs in. */
  z.object({ type: z.literal('command.started'), replyTo, runId: z.string(), cwd: z.string() }),
  /** Output of a run (UTF-8, ANSI escapes removed), only to the connection that started it. */
  z.object({
    type: z.literal('command.output'),
    runId: z.string(),
    stream: CommandStreamSchema,
    text: z.string(),
  }),
  /** End of a run; `exitCode` is null when it was killed or never started. */
  z.object({
    type: z.literal('command.exit'),
    runId: z.string(),
    exitCode: z.number().int().nullable(),
    signal: z.string().nullable(),
    reason: CommandEndReasonSchema,
    durationMs: z.number().nonnegative(),
    /** Output past the cap was dropped. */
    truncated: z.boolean(),
  }),
  /** Reply to `machine.permissions`: never folder contents, only per-row/per-folder status. */
  z.object({
    type: z.literal('machine.permissions.results'),
    replyTo,
    permissions: z.array(MachinePermissionSchema),
  }),
])

export type ServerMessage = z.infer<typeof ServerMessageSchema>
export type ServerMessageType = ServerMessage['type']
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>
