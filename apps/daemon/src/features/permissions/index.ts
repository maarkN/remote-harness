import type { PermissionRequestInfo } from '@remote-harness/protocol'
import { effectiveLocale } from '../../core/config.ts'
import { DaemonError } from '../../core/errors.ts'
import { messagesFor } from '../../core/i18n/index.ts'
import { paths } from '../../core/paths.ts'
import type { DaemonContext } from '../../main.ts'
import type { Connection } from '../../transport/connection.ts'
import { adapterOf } from '../agents/index.ts'
import type { HookEvent } from '../hooks/payloads.ts'
import type { EntryListener } from '../transcript/service.ts'
import { readTailEntries } from '../transcript/transcript-file.ts'
import { type ApprovalEvent, ApprovalLog } from './approval-log.ts'
import { type DecidedRequest, PermissionBroker } from './broker.ts'
import { entryMove, hookMovesOn, type Move } from './handover.ts'
import { listRuleFiles, ruleSources } from './rule-listing.ts'
import { RulesLog } from './rules-log.ts'
import { SCREEN_DIALOG_POLL_MS, ScreenDialogWatcher, type WatchedSession } from './screen-dialogs.ts'
import { removeAllowRule } from './settings-rules.ts'

/** Follows a session's transcript (see `registerTranscriptFeature().follow`). */
export type FollowTranscript = (sessionId: string, listener: EntryListener) => Promise<() => void>

/** A session of the registry, as the approval dialogs need it. */
export type DialogSession = WatchedSession & { cwd: string; transcriptPath: string | null }

/** The approval log drops expired entries at start and then once a day. */
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000

export function registerPermissionsFeature(
  ctx: DaemonContext,
  follow?: FollowTranscript,
  /** Folders of the known sessions, whose project settings hold project rules. */
  sessionCwds: () => readonly string[] = () => [],
  /** The sessions of the registry (their panes hold the agents' approval dialogs). */
  liveSessions: () => readonly DialogSession[] = () => [],
) {
  const paneOf = (sessionId: string) => liveSessions().find((s) => s.id === sessionId)?.paneId ?? null
  const rulesLog = new RulesLog(paths.rulesLog())
  const approvals = new ApprovalLog(paths.approvalLog())
  const messages = messagesFor(effectiveLocale(ctx.config))

  /** The paired device behind a connection, with its name as it is now (it may be revoked later). */
  const deviceOf = (deviceId: string | null | undefined) =>
    deviceId ? { id: deviceId, name: ctx.deviceName?.(deviceId) ?? deviceId } : null
  const log = (event: ApprovalEvent) => {
    approvals.add(event).catch((error) => ctx.logger.warn({ err: error }, 'could not write the approval log'))
  }

  /** Logs a decision a device answered; a question's answers are not approvals. */
  const onDecided = async ({ info, behavior, cwd, by, rule }: DecidedRequest) => {
    let ruleId: string | null = null
    if (rule) {
      try {
        ruleId = (await rulesLog.add({ ...rule, sessionId: info.sessionId })).id
      } catch (error) {
        ctx.logger.warn({ err: error }, 'could not log rule')
      }
      ctx.logger.info({ rule: rule.rule, scope: rule.scope }, 'always-allow rule created from the app')
    }
    if (by === undefined || info.interaction?.kind === 'question') return
    log({
      action: behavior,
      always: rule !== null,
      device: deviceOf(by),
      sessionId: info.sessionId,
      cwd,
      tool: info.tool,
      input: info.input,
      rule: rule?.rule ?? null,
      ruleId,
    })
  }

  /** The session went past its dialog: a tool result or prompt in the transcript, or a turn hook. */
  const watch = (sessionId: string, onMove: (move: Move) => void) => {
    let stopped = false
    let stopFollow: (() => void) | undefined
    const following = async () =>
      follow?.(sessionId, (_id, entry) => {
        const move = entryMove(entry)
        if (move) onMove(move)
      })
    following()
      .then((stop) => {
        if (!stop) return
        if (stopped) stop()
        else stopFollow = stop
      })
      // No transcript yet (or unreadable): the turn hooks still end the handover.
      .catch((error) => ctx.logger.debug({ err: error, sessionId }, 'permission watch without transcript'))
    const offHook = ctx.bus.on('hook', (hook) => {
      if (hook.payload.session_id === sessionId && hookMovesOn(hook.event)) onMove('turn')
    })
    return () => {
      stopped = true
      stopFollow?.()
      offHook()
    }
  }

  const dialogOfProfile = (profileId: string) =>
    adapterOf(ctx.profiles.find((p) => p.id === profileId)?.agent).approvalDialog

  /** Types the phone's answer into the session's approval dialog, if it (the same one) is on screen. */
  const answerDialog = async (info: PermissionRequestInfo, behavior: 'allow' | 'deny') => {
    const dialog = dialogOfProfile(info.profileId)
    const pane = paneOf(info.sessionId)
    if (!dialog || !pane) return false
    const screen = await ctx.tmux.capturePane(pane)
    if (!dialog.isOpen(screen)) return false
    const expected = watcher.identityOf(info.requestId)
    if (expected !== undefined && dialog.identify(screen) !== expected) return false
    await ctx.tmux.sendKeys(pane, behavior === 'allow' ? dialog.allowKeys : dialog.denyKeys)
    // Tool name only: inputs are session content.
    ctx.logger.info({ tool: info.tool, behavior }, 'permission answered in the agent dialog')
    return true
  }

  const broker = new PermissionBroker(ctx.hub, {
    answerDialog,
    timeoutMs: ctx.config.permissionTimeoutSec * 1000,
    questionTimeoutMs: ctx.config.questionTimeoutSec * 1000,
    watch,
    defaultScope: ctx.config.defaultRuleScope,
    profiles: ctx.profiles,
    denyMessage: messages.claudeCode.denied,
    keepPlanningMessage: messages.claudeCode.keepPlanning,
    onRequested: (info) => ctx.bus.emit('permission.requested', info),
    onResolved: (info, outcome, move) => {
      if (info.terminal) ctx.logger.info({ tool: info.tool, outcome }, 'handed-over permission request ended')
      else if (move) ctx.logger.info({ tool: info.tool, move }, 'permission request answered in the terminal')
      // A tool result means the turn goes on; a turn hook sets the state itself.
      ctx.bus.emit('permission.resolved', {
        info,
        outcome,
        ...(move === 'result' ? { continued: true } : {}),
      })
    },
    onHandover: (info, end) => {
      // Tool name only: inputs and answers are session content.
      ctx.logger.info({ tool: info.tool, end }, 'permission hook stopped waiting: answer in the terminal')
      ctx.bus.emit('permission.handover', info)
    },
    onReminder: (info) => ctx.bus.emit('permission.reminder', info),
    onDecided: (decided) => void onDecided(decided),
  })

  const ruleFiles = async () => listRuleFiles(ruleSources(ctx.profiles, sessionCwds()), await rulesLog.list())

  ctx.hookReceiver.setResponder('PermissionRequest', (hook, signal) => broker.handle(hook, signal))
  // The dialog shows once this hook returns: the request is opened and the hook answered at once.
  ctx.hookReceiver.setResponder('PermissionDialog', async (hook) => {
    const dialog = hook.profileId ? dialogOfProfile(hook.profileId) : null
    if (dialog?.detect === 'hook') broker.openDialog(hook, dialog)
    return {}
  })

  /**
   * The tool call a session's transcript shows without a result yet: what its on-screen dialog
   * asks about (the newest one).
   */
  const pendingTool = async (session: DialogSession) => {
    if (!session.transcriptPath) return null
    const format = adapterOf(ctx.profiles.find((p) => p.id === session.profileId)?.agent).transcript
    const { entries } = await readTailEntries(session.transcriptPath, format).catch(() => ({ entries: [] }))
    const answered = new Set(entries.flatMap((e) => (e.kind === 'tool_result' ? [e.toolUseId] : [])))
    const use = entries.findLast((e) => e.kind === 'tool_use' && !answered.has(e.toolUseId))
    return use?.kind === 'tool_use' ? { name: use.name, input: use.input } : null
  }

  const watcher = new ScreenDialogWatcher({
    sessions: liveSessions,
    dialogOf: (session) => {
      const dialog = dialogOfProfile(session.profileId)
      return dialog?.detect === 'screen' ? dialog : null
    },
    capture: (paneId) => ctx.tmux.capturePane(paneId),
    open: async (session, dialog, screen) => {
      const watched = liveSessions().find((s) => s.id === session.id)
      const tool = watched ? await pendingTool(watched) : null
      const hook: HookEvent = {
        event: 'PermissionDialog',
        payload: {
          session_id: session.id,
          cwd: watched?.cwd ?? '',
          screen,
          ...(tool ? { tool_name: tool.name, tool_input: tool.input } : {}),
        },
        paneId: session.paneId,
        profileId: session.profileId,
        receivedAt: new Date().toISOString(),
      }
      // Like the hook Gemini sends: the session shows as waiting.
      ctx.bus.emit('hook', hook)
      return broker.openDialog(hook, dialog)
    },
    isPending: (requestId) => broker.list().some((info) => info.requestId === requestId && !info.terminal),
    gone: (requestId) => broker.dialogGone(requestId),
  })
  if (ctx.profiles.some((p) => adapterOf(p.agent).approvalDialog?.detect === 'screen')) {
    const timer = setInterval(() => void watcher.tick(), SCREEN_DIALOG_POLL_MS)
    ctx.onStop(() => clearInterval(timer))
  }
  const by = (connection: Connection) => connection.deviceId ?? null
  ctx.router.register('permission.respond', async (msg, connection) => {
    await broker.respond(
      msg.requestId,
      { behavior: msg.decision, always: msg.decision === 'allow' ? msg.always : undefined },
      by(connection),
    )
    return undefined
  })
  ctx.router.register('permission.answer', (msg, connection) => {
    broker.answer(msg.requestId, msg.answer, by(connection))
    return undefined
  })
  ctx.router.register('rules.list', async () => ({ type: 'rules.result', files: await ruleFiles() }))
  ctx.router.register('rules.undo', async (msg, connection) => {
    const result = await rulesLog.undo(msg.ruleId)
    if (!result) throw new DaemonError('not_found', 'rule not found')
    if (result.removed) {
      const { entry } = result
      log({
        action: 'undo',
        device: deviceOf(by(connection)),
        sessionId: entry.sessionId,
        cwd: null,
        tool: null,
        rule: entry.rule,
        ruleId: entry.id,
      })
    }
    return undefined
  })
  ctx.router.register('rules.delete', async (msg, connection) => {
    // Only a file the daemon lists itself: never a path the device made up.
    const listed = (await ruleFiles()).find((f) => f.file === msg.file)
    if (!listed) throw new DaemonError('not_found', 'not a listed settings file')
    if (await removeAllowRule(listed.file, msg.rule)) {
      const app = listed.rules.find((r) => r.rule === msg.rule && r.origin === 'app')
      log({
        action: 'delete',
        device: deviceOf(by(connection)),
        sessionId: null,
        cwd: listed.project,
        tool: null,
        rule: msg.rule,
        ruleId: app?.origin === 'app' ? app.ruleId : null,
      })
    }
    return undefined
  })
  ctx.router.register('approvals.list', async () => ({
    type: 'approvals.result',
    entries: await approvals.list(),
  }))
  // The app asks again once its stores listen, so a replay sent before that is not lost (#384).
  ctx.router.register('permissions.list', () => ({ type: 'permissions.result', requests: broker.list() }))
  // A phone that connects late still sees requests that are waiting.
  ctx.onClientConnected((connection) => {
    for (const request of broker.list()) connection.send({ type: 'permission.request', request })
  })
  const prune = () => {
    approvals.prune().catch((error) => ctx.logger.warn({ err: error }, 'could not prune the approval log'))
  }
  prune()
  const pruneTimer = setInterval(prune, PRUNE_INTERVAL_MS)
  pruneTimer.unref()
  ctx.onStop(() => {
    clearInterval(pruneTimer)
    broker.dispose()
  })

  return { broker, rulesLog, approvals }
}
