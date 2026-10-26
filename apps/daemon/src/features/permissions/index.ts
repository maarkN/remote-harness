import { effectiveLocale } from '../../core/config.ts'
import { DaemonError } from '../../core/errors.ts'
import { messagesFor } from '../../core/i18n/index.ts'
import { paths } from '../../core/paths.ts'
import type { DaemonContext } from '../../main.ts'
import type { Connection } from '../../transport/connection.ts'
import type { EntryListener } from '../transcript/service.ts'
import { type ApprovalEvent, ApprovalLog } from './approval-log.ts'
import { type DecidedRequest, PermissionBroker } from './broker.ts'
import { entryMovesOn, hookMovesOn } from './handover.ts'
import { listRuleFiles, ruleSources } from './rule-listing.ts'
import { RulesLog } from './rules-log.ts'
import { removeAllowRule } from './settings-rules.ts'

/** Follows a session's transcript (see `registerTranscriptFeature().follow`). */
export type FollowTranscript = (sessionId: string, listener: EntryListener) => Promise<() => void>

/** The approval log drops expired entries at start and then once a day. */
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000

export function registerPermissionsFeature(
  ctx: DaemonContext,
  follow?: FollowTranscript,
  /** Folders of the known sessions, whose project settings hold project rules. */
  sessionCwds: () => readonly string[] = () => [],
) {
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
  const watch = (sessionId: string, onMove: () => void) => {
    let stopped = false
    let stopFollow: (() => void) | undefined
    const following = async () =>
      follow?.(sessionId, (_id, entry) => {
        if (entryMovesOn(entry)) onMove()
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
      if (hook.payload.session_id === sessionId && hookMovesOn(hook.event)) onMove()
    })
    return () => {
      stopped = true
      stopFollow?.()
      offHook()
    }
  }

  const broker = new PermissionBroker(ctx.hub, {
    timeoutMs: ctx.config.permissionTimeoutSec * 1000,
    questionTimeoutMs: ctx.config.questionTimeoutSec * 1000,
    watch,
    defaultScope: ctx.config.defaultRuleScope,
    profiles: ctx.profiles,
    denyMessage: messages.claudeCode.denied,
    keepPlanningMessage: messages.claudeCode.keepPlanning,
    onRequested: (info) => ctx.bus.emit('permission.requested', info),
    onResolved: (info, outcome) => {
      if (info.terminal) ctx.logger.info({ tool: info.tool, outcome }, 'handed-over permission request ended')
      ctx.bus.emit('permission.resolved', { info, outcome })
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
  const by = (connection: Connection) => connection.deviceId ?? null
  ctx.router.register('permission.respond', (msg, connection) => {
    broker.respond(
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
