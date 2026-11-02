import { paths } from '../../core/paths.ts'
import type { DaemonContext } from '../../main.ts'
import type { LifecycleService } from '../lifecycle/service.ts'
import type { PushService } from '../push/service.ts'
import type { QueueService } from '../queue/service.ts'
import { ScheduleService } from './service.ts'

/**
 * Scheduled prompts (#432): the app creates, edits, removes and runs them; the computer runs them
 * by its clock. A session target goes through the queue (`auto`: now when free, queued when busy),
 * a new-session target through the lifecycle's start with the prompt first. Call `start` once the
 * sessions are restored, so a schedule due meanwhile finds its session.
 */
export function registerSchedulesFeature(
  ctx: DaemonContext,
  deps: {
    queue: Pick<QueueService, 'submit'>
    lifecycle: Pick<LifecycleService, 'start'>
    push: Pick<PushService, 'notify' | 'messageForSchedule'>
    /** A session's profile (for the push's mute rule); null when unknown. */
    profileOf: (sessionId: string) => string | null
  },
) {
  const service = new ScheduleService({
    runner: {
      submit: (sessionId, prompt) => deps.queue.submit(sessionId, prompt, [], 'auto'),
      start: (target, prompt) =>
        deps.lifecycle.start(target.profileId, target.cwd, {
          worktree: target.worktree,
          ...(target.name ? { name: target.name } : {}),
          prompt,
        }),
    },
    broadcaster: ctx.hub,
    statePath: paths.schedules(),
    logger: ctx.logger,
    notify: (event, schedule) => {
      const profileId =
        schedule.target.kind === 'new' ? schedule.target.profileId : deps.profileOf(schedule.target.sessionId)
      void deps.push.notify(deps.push.messageForSchedule(event, schedule, profileId))
    },
  })
  ctx.router.register('schedules.list', () => ({ type: 'schedules.result', schedules: service.list() }))
  ctx.router.register('schedule.create', async (msg) => ({
    type: 'ack',
    data: { scheduleId: (await service.create(msg.schedule)).id },
  }))
  ctx.router.register('schedule.update', async (msg) => {
    await service.update(msg.scheduleId, msg.schedule)
    return undefined
  })
  ctx.router.register('schedule.remove', async (msg) => {
    await service.remove(msg.scheduleId)
    return undefined
  })
  ctx.router.register('schedule.run', async (msg) => {
    await service.run(msg.scheduleId)
    return undefined
  })
  ctx.onStop(() => service.dispose())
  return { service, start: () => service.start() }
}
