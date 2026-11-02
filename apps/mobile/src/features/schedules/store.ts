import type { Schedule, ScheduleInput } from '@remote-harness/protocol'
import { create } from 'zustand'
import type { DaemonClient, Hello } from '@/core/connection/daemon-client'

type SchedulesState = {
  schedules: Schedule[]
  /** The daemon keeps schedules (`auth.ok.schedules`); older daemons do not, and the entry points hide. */
  supported: boolean
  loaded: boolean
}

export const useSchedulesStore = create<SchedulesState>(() => ({
  schedules: [],
  supported: false,
  loaded: false,
}))

/** Mirrors the computer's schedules: the list on (re)connect, then every `schedules.updated`. */
export function bindSchedules(client: DaemonClient): () => void {
  const load = (hello: Hello) => {
    const supported = hello.schedules === true
    useSchedulesStore.setState({ supported, schedules: [], loaded: !supported })
    if (!supported) return
    client
      .request({ type: 'schedules.list' })
      .then((reply) => {
        if (reply.type === 'schedules.result')
          useSchedulesStore.setState({ schedules: reply.schedules, loaded: true })
      })
      .catch(() => undefined)
  }
  const offs = [
    client.onReady(load),
    client.on('schedules.updated', ({ schedules }) =>
      useSchedulesStore.setState({ schedules, loaded: true }),
    ),
  ]
  if (client.hello) load(client.hello)
  return () => {
    for (const off of offs) off()
    useSchedulesStore.setState({ schedules: [], supported: false, loaded: false })
  }
}

export async function createSchedule(client: DaemonClient, input: ScheduleInput): Promise<void> {
  await client.request({ type: 'schedule.create', schedule: input })
}

export async function updateSchedule(
  client: DaemonClient,
  scheduleId: string,
  input: ScheduleInput,
): Promise<void> {
  await client.request({ type: 'schedule.update', scheduleId, schedule: input })
}

export async function removeSchedule(client: DaemonClient, scheduleId: string): Promise<void> {
  await client.request({ type: 'schedule.remove', scheduleId })
}

/** Runs it now, enabled or not (Run now after a missed or failed run). */
export async function runSchedule(client: DaemonClient, scheduleId: string): Promise<void> {
  await client.request({ type: 'schedule.run', scheduleId })
}
