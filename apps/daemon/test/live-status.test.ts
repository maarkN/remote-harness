import { LiveDataMessageSchema, type TranscriptEntry } from '@remote-harness/protocol'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { messagesFor } from '../src/core/i18n/index.ts'
import { silentLogger } from '../src/core/logger.ts'
import { hostName, shortenHome } from '../src/core/paths.ts'
import { LiveStatusService } from '../src/features/live-status/service.ts'
import {
  applyTodo,
  DONE_DISMISS_MS,
  eventsForEntry,
  initialLiveStatus,
  type LiveEvent,
  liveProps,
  planSend,
  reduceLiveStatus,
  STEP_INTERVAL_MS,
  stepForEntry,
  stepTarget,
  stopEvent,
  taskCounts,
  todoChange,
  todoProgress,
  toolStep,
} from '../src/features/live-status/status.ts'
import { buildLiveMessage, type LiveMessage, type PushSender } from '../src/features/push/sender.ts'

const en = messagesFor('en-US').live
const pt = messagesFor('pt-BR').live

const base = { cursor: 1, index: 0, uuid: 'u', key: 'u:0', timestamp: null, isSidechain: false }

describe('live status reducer', () => {
  test('tools map to fixed categories', () => {
    expect(toolStep('Bash')).toBe('command')
    expect(toolStep('MultiEdit')).toBe('editing')
    expect(toolStep('Grep')).toBe('searching')
    expect(toolStep('mcp__github__create_issue')).toBe('tool')
  })

  test('transcript entries become steps, sidechains and user lines do not', () => {
    const use: TranscriptEntry = {
      ...base,
      kind: 'tool_use',
      toolUseId: 't',
      name: 'Bash',
      input: { command: 'rm -rf x' },
    }
    // Only the program leaves the daemon, never its arguments.
    expect(stepForEntry(use)).toEqual({
      type: 'step',
      step: 'command',
      tool: 'Bash',
      target: 'rm',
      activity: 'command',
    })
    expect(stepForEntry({ ...base, kind: 'thinking', text: 'secret' })).toEqual({
      type: 'step',
      step: 'thinking',
      tool: null,
      activity: 'thinking',
    })
    expect(stepForEntry({ ...use, isSidechain: true })).toBeNull()
    expect(stepForEntry({ ...base, kind: 'user', text: 'prompt', images: [] })).toBeNull()
  })

  test('a turn goes working → waiting → working → done, and stays done until a new prompt', () => {
    const events: LiveEvent[] = [
      { type: 'step', step: 'command', tool: 'Bash' },
      { type: 'waiting', permission: true },
      { type: 'resumed' },
      { type: 'step', step: 'editing', tool: 'Edit' },
      { type: 'stop' },
      { type: 'step', step: 'reading', tool: 'Read' },
    ]
    let status = initialLiveStatus(0)
    const states = events.map((event, i) => {
      status = reduceLiveStatus(status, event, (i + 1) * 10)
      return status
    })
    expect(states.map((s) => [s.state, s.step, s.toolCount, s.changedAt, s.endedAt])).toEqual([
      ['working', 'command', 1, 0, null],
      ['waiting', 'permission', 1, 20, null],
      ['working', null, 1, 30, null],
      ['working', 'editing', 2, 30, null],
      ['done', null, 2, 50, 50],
      ['done', null, 2, 50, 50],
    ])
    expect(reduceLiveStatus(states[4]!, { type: 'prompt' }, 70)).toEqual(initialLiveStatus(70))
  })

  test('latest steps: newest first, repeats merged, at most three', () => {
    let status = initialLiveStatus(0)
    const steps: LiveEvent[] = [
      { type: 'step', step: 'thinking', tool: null },
      { type: 'step', step: 'reading', tool: 'Read' },
      { type: 'step', step: 'reading', tool: 'Read' },
      { type: 'step', step: 'searching', tool: 'Grep' },
      { type: 'step', step: 'command', tool: 'Bash' },
    ]
    for (const event of steps) status = reduceLiveStatus(status, event, 1)
    expect(status.recent).toEqual([
      { step: 'command', tool: 'Bash', count: 1 },
      { step: 'searching', tool: 'Grep', count: 1 },
      { step: 'reading', tool: 'Read', count: 2 },
    ])
  })

  test('state changes go now, step changes are throttled', () => {
    const working = initialLiveStatus(0)
    const step = reduceLiveStatus(working, { type: 'step', step: 'command', tool: 'Bash' }, 0)
    expect(planSend(null, working, null, 0)).toEqual({ when: 'now' })
    expect(planSend(working, step, 1_000, 5_000)).toEqual({
      when: 'later',
      delayMs: STEP_INTERVAL_MS - 4_000,
    })
    expect(planSend(working, step, 0, STEP_INTERVAL_MS)).toEqual({ when: 'now' })
    expect(planSend(step, step, 0, 1)).toEqual({ when: 'never' })
    expect(planSend(step, reduceLiveStatus(step, { type: 'stop' }, 1), 0, 1)).toEqual({ when: 'now' })
    const thinking = reduceLiveStatus(initialLiveStatus(0), { type: 'step', step: 'thinking', tool: null }, 0)
    const again = reduceLiveStatus(thinking, { type: 'step', step: 'thinking', tool: null }, 0)
    expect(planSend(thinking, again, 0, 1)).toEqual({ when: 'later', delayMs: STEP_INTERVAL_MS - 1 })
  })

  test('props are translated and carry only the session title and folder', () => {
    const info = { title: 'Work', host: 'mac', session: 'Fix login', path: '~/app' }
    let status = reduceLiveStatus(initialLiveStatus(7), { type: 'step', step: 'command', tool: 'Bash' }, 8)
    status = reduceLiveStatus(status, { type: 'step', step: 'tool', tool: 'mcp__github__create_issue' }, 9)
    status = reduceLiveStatus(status, { type: 'step', step: 'thinking', tool: null }, 9)
    status = reduceLiveStatus(status, { type: 'step', step: 'thinking', tool: null }, 9)
    expect(liveProps(status, info, en)).toEqual({
      title: 'Work',
      state: 'working',
      status: 'Working',
      step: 'thinking',
      tools: '2 tools',
      startedAt: 7,
      host: 'mac',
      session: 'Fix login',
      path: '~/app',
      recent: ['Thinking ×2', 'create_issue · using a tool', 'Bash · running a command'],
      ago: '{time} ago',
      changedAt: 7,
      endedAt: null,
      glyphs: ['·', '·', '·', '⌘'],
      pending: null,
      hint: '',
      tasks: '',
      current: '',
      progress: null,
      activity: '',
      task: '',
      notifiedAt: 0,
      link: '',
      labels: {
        working: 'working',
        waiting: 'waiting',
        total: 'total',
        notified: 'notified',
        finished: 'finished',
        open: 'Open',
      },
    })
    const tasks = (subagents: number, background: number) => ({ ...status, tasks: { subagents, background } })
    expect(liveProps(tasks(1, 0), info, en).tasks).toBe('1 subagent')
    expect(liveProps(tasks(2, 1), info, en).tasks).toBe('2 subagents · 1 background task')
    expect(liveProps(tasks(0, 2), info, pt).tasks).toBe('2 tarefas em segundo plano')
    expect(liveProps(tasks(1, 1), info, messagesFor('es-ES').live).tasks).toBe(
      '1 subagente · 1 tarea en segundo plano',
    )
    expect(liveProps({ ...status, toolCount: 3 }, info, pt)).toMatchObject({
      status: 'Trabalhando',
      step: 'pensando',
      tools: '3 ferramentas',
      recent: ['Pensando ×2', 'create_issue · usando uma ferramenta', 'Bash · executando um comando'],
      ago: 'há {time}',
    })
  })

  test('a Stop with agents still working in the background keeps the status working', () => {
    const workflow = { id: 'w1', type: 'workflow', status: 'running', description: 'review', name: 'review' }
    expect(stopEvent([workflow])).toBeNull()
    expect(stopEvent([{ id: 'b1', type: 'shell', status: 'running', description: 'dev' }])).toEqual({
      type: 'stop',
    })
    expect(stopEvent(undefined)).toEqual({ type: 'stop' })
  })

  test('tasks in parallel: running subagents and background tasks apart, kept across turns', () => {
    const subagent = (state: 'running' | 'done') => ({ state }) as never
    expect(taskCounts({ backgroundTasks: 1, subagents: [subagent('running'), subagent('done')] })).toEqual({
      subagents: 1,
      background: 1,
    })
    expect(taskCounts({ backgroundTasks: 0, subagents: [] })).toEqual({ subagents: 0, background: 0 })
    const counts = (subagents: number, background: number) => ({ subagents, background })
    let status = reduceLiveStatus(initialLiveStatus(1), { type: 'tasks', counts: counts(1, 1) }, 2)
    expect(status.tasks).toEqual(counts(1, 1))
    // The same counts again change nothing.
    expect(reduceLiveStatus(status, { type: 'tasks', counts: counts(1, 1) }, 2)).toBe(status)
    status = reduceLiveStatus(status, { type: 'stop' }, 3)
    // Background tasks outlive the turn: the done status still follows the count.
    status = reduceLiveStatus(status, { type: 'tasks', counts: counts(0, 1) }, 4)
    expect(status).toMatchObject({ state: 'done', tasks: counts(0, 1) })
    expect(reduceLiveStatus(status, { type: 'prompt' }, 5)).toMatchObject({
      state: 'working',
      tasks: counts(0, 1),
    })
    // The session closing during the done window closes it (and ends the activity at once).
    const closed = reduceLiveStatus(status, { type: 'end' }, 6)
    expect(closed).toMatchObject({ state: 'closed', endedAt: 6 })
    expect(reduceLiveStatus(closed, { type: 'tasks', counts: counts(3, 0) }, 7)).toBe(closed)
    // A count change is throttled like a step.
    const sent = initialLiveStatus(1)
    expect(planSend(sent, { ...sent, tasks: counts(1, 0) }, 1, 2)).toMatchObject({ when: 'later' })
  })

  test('folder and host names', () => {
    expect(shortenHome('/Users/me/app', '/Users/me')).toBe('~/app')
    expect(shortenHome('/Users/me', '/Users/me')).toBe('~')
    expect(shortenHome('/Users/meow/app', '/Users/me')).toBe('/Users/meow/app')
    expect(shortenHome('/srv/app', '/')).toBe('/srv/app')
    expect(hostName('MacBook-Pro.local')).toBe('MacBook-Pro')
    expect(hostName('devbox')).toBe('devbox')
    expect(hostName('MacBook-Pro.local', { REMOTE_HARNESS_HOST_NAME: 'studio' })).toBe('studio')
    expect(hostName('MacBook-Pro.local', { REMOTE_HARNESS_HOST_NAME: '' })).toBe('MacBook-Pro')
  })
})

describe('current step target', () => {
  test('commands give only their program, with the subcommand for a few programs', () => {
    const bash = (command: string) => stepTarget('Bash', { command })
    expect(bash('pnpm test --filter daemon')).toBe('pnpm test')
    expect(bash('git push origin secret-branch')).toBe('git push')
    expect(bash('cd apps/daemon && FOO=1 sudo npm run build')).toBe('npm run')
    expect(bash('/usr/local/bin/python3 script.py --token abc')).toBe('python3')
    expect(bash('curl -H "Authorization: Bearer x" https://api')).toBe('curl')
    expect(bash('echo hunter2')).toBe('echo')
    // The subcommand must be a plain word: no flags, paths or values.
    expect(bash('git -C /secret/path status')).toBe('git')
    expect(bash('npm Secret')).toBe('npm')
    expect(bash('"./my script.sh" arg')).toBeNull()
    expect(bash('   ')).toBeNull()
  })

  test('files give their base name, web fetches their host, subagents their type', () => {
    expect(stepTarget('Edit', { file_path: '/Users/me/project/src/app.ts' })).toBe('app.ts')
    expect(stepTarget('Read', { file_path: 'C:\\Users\\me\\notes.md' })).toBe('notes.md')
    expect(stepTarget('NotebookEdit', { notebook_path: '/x/analysis.ipynb' })).toBe('analysis.ipynb')
    expect(stepTarget('WebFetch', { url: 'https://github.com/org/private-repo?token=1' })).toBe('github.com')
    expect(stepTarget('WebFetch', { url: 'not a url' })).toBeNull()
    expect(stepTarget('Agent', { subagent_type: 'Explore', prompt: 'secret' })).toBe('Explore')
    expect(stepTarget('Task', { subagent_type: 'has spaces in it' })).toBeNull()
    expect(stepTarget('Write', { file_path: `/x/${'a'.repeat(60)}.ts` })?.length).toBe(40)
  })

  test('tools with free text give no target', () => {
    expect(stepTarget('Grep', { pattern: 'password', path: '/secret' })).toBeNull()
    expect(stepTarget('Glob', { pattern: '**/*.env' })).toBeNull()
    expect(stepTarget('WebSearch', { query: 'private question' })).toBeNull()
    expect(stepTarget('mcp__github__create_issue', { title: 'x' })).toBeNull()
    expect(stepTarget('Edit', {})).toBeNull()
  })

  test('the current step shows in the props, and clears when the turn ends', () => {
    const info = { title: 'Work', host: 'mac', session: 'Fix login', path: '~/app' }
    let status = reduceLiveStatus(
      initialLiveStatus(0),
      { type: 'step', step: 'command', tool: 'Bash', target: 'pnpm test' },
      1,
    )
    expect(liveProps(status, info, en).current).toBe('Bash · pnpm test')
    status = reduceLiveStatus(status, { type: 'step', step: 'tool', tool: 'mcp__github__create_issue' }, 2)
    expect(liveProps(status, info, en).current).toBe('create_issue')
    status = reduceLiveStatus(status, { type: 'step', step: 'thinking', tool: null }, 3)
    expect(liveProps(status, info, en).current).toBe('')
    status = reduceLiveStatus(status, { type: 'step', step: 'editing', tool: 'Edit', target: 'app.ts' }, 4)
    expect(liveProps(reduceLiveStatus(status, { type: 'stop' }, 5), info, en).current).toBe('')
    // A new current step is throttled like any step.
    const next = reduceLiveStatus(status, { type: 'step', step: 'editing', tool: 'Edit', target: 'b.ts' }, 6)
    expect(planSend(status, next, 4, 6)).toMatchObject({ when: 'later' })
  })
})

describe('todo progress', () => {
  const tool = (name: string, input: Record<string, unknown>): TranscriptEntry => ({
    ...base,
    kind: 'tool_use',
    toolUseId: 't',
    name,
    input,
  })

  test('TodoWrite gives a snapshot of the list', () => {
    const todos = [
      { content: 'secret plan a', status: 'completed' },
      { content: 'b', status: 'in_progress' },
      { content: 'c', status: 'pending' },
    ]
    expect(todoChange('TodoWrite', { todos })).toEqual({ kind: 'snapshot', done: 1, total: 3, active: 'b' })
    expect(todoChange('TodoWrite', { todos: 'nope' })).toBeNull()
    expect(todoChange('Bash', { command: 'ls' })).toBeNull()
    expect(eventsForEntry(tool('TodoWrite', { todos }))).toEqual([
      { type: 'step', step: 'planning', tool: 'TodoWrite', target: null, activity: 'planning' },
      { type: 'todo', change: { kind: 'snapshot', done: 1, total: 3, active: 'b' } },
    ])
    expect(eventsForEntry({ ...tool('TodoWrite', { todos }), isSidechain: true })).toEqual([])
    expect(applyTodo(null, { kind: 'snapshot', done: 0, total: 0 })).toBeNull()
  })

  test('TaskCreate and TaskUpdate build the counts, each task done once', () => {
    let todo = applyTodo(null, { kind: 'created' })
    todo = applyTodo(todo, { kind: 'created' })
    todo = applyTodo(todo, { kind: 'created' })
    expect(todoProgress(todo)).toEqual({ done: 0, total: 3 })
    const update = (taskId: string, status: string) => {
      const change = todoChange('TaskUpdate', { taskId, status })
      if (change) todo = applyTodo(todo, change)
    }
    update('1', 'completed')
    update('1', 'completed')
    update('2', 'in_progress')
    expect(todoProgress(todo)).toEqual({ done: 1, total: 3 })
    update('1', 'pending')
    expect(todoProgress(todo)).toEqual({ done: 0, total: 3 })
    update('2', 'completed')
    update('3', 'deleted')
    expect(todoProgress(todo)).toEqual({ done: 1, total: 2 })
    expect(todoChange('TaskUpdate', { taskId: '1' })).toBeNull()
    // An update with no known list (the list came before the daemon followed) changes nothing.
    expect(applyTodo(null, { kind: 'updated', taskId: '9', status: 'completed' })).toBeNull()
  })

  test('the props carry the progress; an unfinished list carries over to the next turn', () => {
    const info = { title: 'Work', host: 'mac', session: 'Fix login', path: '~/app' }
    const snapshot = (done: number, total: number): LiveEvent => ({
      type: 'todo',
      change: { kind: 'snapshot', done, total },
    })
    let status = reduceLiveStatus(initialLiveStatus(0), snapshot(3, 7), 1)
    expect(liveProps(status, info, en).progress).toEqual({ done: 3, total: 7 })
    status = reduceLiveStatus(status, { type: 'stop' }, 2)
    status = reduceLiveStatus(status, { type: 'prompt' }, 3)
    expect(liveProps(status, info, en).progress).toEqual({ done: 3, total: 7 })
    status = reduceLiveStatus(status, snapshot(7, 7), 4)
    status = reduceLiveStatus(status, { type: 'prompt' }, 5)
    expect(liveProps(status, info, en).progress).toBeNull()
    // A progress change is throttled like a step.
    const next = reduceLiveStatus(status, snapshot(1, 2), 6)
    expect(planSend(status, next, 5, 6)).toMatchObject({ when: 'later' })
  })
})

describe('pending permission and glyphs', () => {
  const info = { title: 'Work', host: 'mac', session: 'Fix login', path: '~/app' }

  test('a tool permission sets pending with translated labels, cleared when resolved', () => {
    let status = reduceLiveStatus(initialLiveStatus(0), { type: 'step', step: 'command', tool: 'Bash' }, 1)
    status = reduceLiveStatus(
      status,
      { type: 'waiting', permission: true, pending: { requestId: 'r1', tool: 'mcp__gh__pr' } },
      2,
    )
    expect(status).toMatchObject({ state: 'waiting', step: 'permission', pending: { requestId: 'r1' } })
    expect(status.glyphs).toEqual(['permission', 'command'])
    // Hearing about the same wait again neither duplicates the glyph nor loses the request.
    status = reduceLiveStatus(status, { type: 'waiting', permission: true }, 3)
    expect(status.glyphs).toEqual(['permission', 'command'])
    const props = liveProps(status, info, pt)
    expect(props.pending).toEqual({ requestId: 'r1', tool: 'pr', allow: 'Permitir', deny: 'Negar' })
    expect(props.glyphs).toEqual(['?', '⌘'])
    // Handed over to the terminal: still waiting, without the lock-screen answer.
    const handedOver = reduceLiveStatus(status, { type: 'waiting', permission: true, pending: null }, 3)
    expect(handedOver).toMatchObject({ state: 'waiting', step: 'permission', pending: null })
    const resumed = reduceLiveStatus(status, { type: 'resumed' }, 4)
    expect(resumed).toMatchObject({ state: 'working', pending: null })
    expect(liveProps(resumed, info, en).pending).toBeNull()
  })

  test('a pending change is sent at once', () => {
    const working = reduceLiveStatus(initialLiveStatus(0), { type: 'step', step: 'command', tool: 'Bash' }, 0)
    const waiting = reduceLiveStatus(
      working,
      { type: 'waiting', permission: true, pending: { requestId: 'r1', tool: 'Bash' } },
      1,
    )
    const other = { ...waiting, pending: { requestId: 'r2', tool: 'Edit' } }
    expect(planSend(waiting, other, 1, 2)).toEqual({ when: 'now' })
  })

  test('glyphs keep the last five steps, newest first; hints for done and closed', () => {
    let status = initialLiveStatus(0)
    for (const [step, tool] of [
      ['command', 'Bash'],
      ['editing', 'Edit'],
      ['searching', 'Grep'],
      ['web', 'WebFetch'],
      ['agent', 'Task'],
      ['reading', 'Read'],
    ] as const) {
      status = reduceLiveStatus(status, { type: 'step', step, tool }, 1)
    }
    expect(liveProps(status, info, en).glyphs).toEqual(['⌕', '⌥', '⇄', '⌕', '✎'])
    const done = reduceLiveStatus(status, { type: 'stop' }, 2)
    expect(liveProps(done, info, en).hint).toBe('total')
    const closed = reduceLiveStatus(status, { type: 'end' }, 2)
    expect(liveProps(closed, info, en).hint).toBe('transcript kept · resume from the app')
    expect(liveProps(closed, info, pt).hint).toBe('transcrição mantida · retome pelo app')
  })
})

describe('buildLiveMessage', () => {
  const props = liveProps(
    initialLiveStatus(1_000_000),
    { title: 'Work', host: 'mac', session: '', path: '~/app' },
    en,
  )
  const message: LiveMessage = {
    sessionId: 's1',
    platform: 'ios',
    fcmToken: 'fcm',
    activityToken: 'act',
    props,
    event: 'update',
    at: 2_000_000,
    staleAt: 3_000_000,
  }

  test('iOS: ActivityKit content-state through liveActivityToken', () => {
    expect(buildLiveMessage(message)).toEqual({
      token: 'fcm',
      data: { sessionId: 's1', event: 'live' },
      apns: {
        liveActivityToken: 'act',
        headers: { 'apns-priority': '5' },
        payload: {
          aps: {
            timestamp: 2000,
            event: 'update',
            'content-state': { name: 'SessionActivity', props: JSON.stringify(props) },
            'stale-date': 3000,
          },
        },
      },
    })
    const ended = buildLiveMessage({ ...message, event: 'end', dismissAt: 2_900_000 })
    expect(ended.apns?.headers).toEqual({ 'apns-priority': '10' })
    expect(ended.apns?.payload.aps).toMatchObject({ event: 'end', 'dismissal-date': 2900 })
  })

  /** The system-drawn notification of an Android message (absent for data messages). */
  const notification = (m: LiveMessage) => {
    const built = buildLiveMessage(m)
    return built.android && 'notification' in built.android ? built.android.notification : undefined
  }

  test('Android: one tagged, silent notification per session', () => {
    const android = buildLiveMessage({ ...message, platform: 'android', activityToken: undefined })
    expect(android).toMatchObject({
      token: 'fcm',
      android: {
        notification: {
          tag: 'live-s1',
          channelId: 'live-status',
          title: 'Work · Working',
          body: 'Working',
          sticky: true,
          notificationPriority: 'PRIORITY_LOW',
        },
      },
    })
    expect(notification({ ...message, platform: 'android', event: 'end' })?.sticky).toBe(false)
    const named = { ...message, platform: 'android' as const, props: { ...props, session: 'Fix login' } }
    expect(notification(named)?.title).toBe('Fix login · Working')
    // The finished turn can be swiped away while it waits; the body names the tasks in parallel.
    const done = { ...message, platform: 'android' as const, props: { ...props, state: 'done' as const } }
    expect(notification(done)?.sticky).toBe(false)
    const tasks = { ...message, platform: 'android' as const, props: { ...props, tasks: '2 subagents' } }
    expect(notification(tasks)?.body).toBe('2 subagents')
    // The current step and the progress come first.
    const step = {
      ...message,
      platform: 'android' as const,
      props: { ...props, current: 'Edit · app.ts', progress: { done: 3, total: 7 } },
    }
    expect(notification(step)?.body).toBe('Edit · app.ts · ☑ 3/7')
  })

  test('Android with androidDataMessages: a data message the app draws, collapsed per session', () => {
    const android: LiveMessage = {
      ...message,
      platform: 'android',
      activityToken: undefined,
      androidDataMessages: true,
    }
    const built = buildLiveMessage(android)
    expect(built).toEqual({
      token: 'fcm',
      data: { sessionId: 's1', event: 'live', live: JSON.stringify({ event: 'update', props }) },
      android: { priority: 'normal', collapseKey: 'live-s1' },
    })
    expect(built).not.toHaveProperty('notification')
    const live = (m: { data: Record<string, string> }) => JSON.parse(m.data.live ?? '')
    expect(LiveDataMessageSchema.parse(live(built))).toEqual({ event: 'update', props })
    // What the user may act on goes at once.
    const pending = liveProps(
      reduceLiveStatus(
        initialLiveStatus(1_000_000),
        {
          type: 'waiting',
          permission: true,
          pending: { requestId: 'r1', tool: 'mcp__github__create_issue' },
        },
        1_500_000,
      ),
      { title: 'Work', host: 'mac', session: 'Fix login', path: '~/app' },
      pt,
    )
    const waiting = buildLiveMessage({ ...android, props: pending })
    expect(waiting.android).toMatchObject({ priority: 'high' })
    expect(live(waiting).props.pending).toEqual({
      requestId: 'r1',
      tool: 'create_issue',
      allow: pt.allow,
      deny: pt.deny,
    })
    expect(buildLiveMessage({ ...android, event: 'end' }).android).toMatchObject({ priority: 'high' })
  })

  /** A busy status with every field at its longest. */
  const busyProps = () =>
    liveProps(
      {
        ...initialLiveStatus(1_000_000),
        recent: [
          { step: 'command', tool: 'Bash', count: 12 },
          { step: 'editing', tool: 'MultiEdit', count: 3 },
          { step: 'searching', tool: 'Grep', count: 1 },
        ],
        glyphs: ['command', 'editing', 'searching', 'reading', 'web'],
        toolCount: 99,
        tasks: { subagents: 12, background: 12 },
        current: { tool: 'mcp__some_server__some_long_tool_name', target: 'x'.repeat(40) },
        todo: {
          done: 999,
          total: 999,
          completed: [],
          active: `${'ã'.repeat(47)}…`,
          activeId: '999',
          forms: [],
        },
        activity: 'installing',
        state: 'waiting',
        pending: { requestId: 'a'.repeat(36), tool: 'mcp__some_server__some_long_tool_name' },
      },
      {
        title: 'A long profile name',
        host: 'a-long-host-name.local',
        session: 'x'.repeat(120),
        path: `~/${'p'.repeat(120)}`,
        link: `claude-remote://session/${'s'.repeat(36)}`,
      },
      pt,
      { showTask: true, notifiedAt: 1_800_000_000_000 },
    )
  const palette = {
    background: '#0D0D0D',
    text: '#E8E6E3',
    textMuted: '#8A8784',
    accent: '#E8A33D',
    success: '#7FB069',
    warning: '#F3DC7A',
  }

  test('iOS: a busy update stays under the APNs 4 KB payload limit', () => {
    const built = buildLiveMessage({ ...message, props: { ...busyProps(), palette } })
    expect(Buffer.byteLength(JSON.stringify(built.apns?.payload), 'utf8')).toBeLessThan(4_096)
  })

  test('Android data messages stay well under the FCM data limit', () => {
    const busy = busyProps()
    const built = buildLiveMessage({
      ...message,
      platform: 'android',
      androidDataMessages: true,
      props: { ...busy, palette },
    })
    expect(JSON.stringify(built.data).length).toBeLessThan(3_000)
  })
})

describe('LiveStatusService', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function setup(
    opts: { muted?: boolean; invalid?: boolean; tasks?: { subagents: number; background: number } } = {},
  ) {
    let now = 1_000
    let onEvent: ((event: LiveEvent) => void) | null = null
    const unfollow = vi.fn()
    const sent: LiveMessage[] = []
    const sender: PushSender = {
      async send() {
        return { invalidTokens: [] }
      },
      async sendLive(message) {
        sent.push(message)
        return { invalid: opts.invalid ?? false }
      },
    }
    const service = new LiveStatusService(sender, silentLogger, {
      messages: en,
      profileOf: () => 'p1',
      info: () => ({ title: 'Work', host: 'mac', session: 'Fix login', path: '~/app' }),
      isMuted: () => opts.muted ?? false,
      ...(opts.tasks ? { tasksOf: () => opts.tasks ?? { subagents: 0, background: 0 } } : {}),
      follow: async (_sessionId, listener) => {
        onEvent = listener
        return unfollow
      },
      now: () => now,
    })
    return {
      service,
      sent,
      unfollow,
      emit: (event: LiveEvent) => onEvent?.(event),
      advance: (ms: number) => {
        now += ms
        vi.advanceTimersByTime(ms)
      },
    }
  }

  const register = { sessionId: 's1', platform: 'ios' as const, fcmToken: 'fcm', activityToken: 'act' }

  test('echoes the app palette in every update of the registration', async () => {
    const { service, sent } = setup()
    const palette = {
      background: '#0D0D0D',
      text: '#E8E6E3',
      textMuted: '#8A8784',
      accent: '#E8A33D',
      success: '#7FB069',
      warning: '#F3DC7A',
    }
    await service.register({ ...register, palette })
    service.handle('s1', { type: 'waiting', permission: true })
    expect(sent.map((m) => m.props.palette)).toEqual([palette, palette])
    // Older apps register without one: the widget then falls back to its dark colors.
    await service.register({ ...register, sessionId: 's2' })
    expect(sent.at(-1)?.props.palette).toBeUndefined()
  })

  test('the opt-in task follows the registration and survives a re-register without it', async () => {
    const { service, sent } = setup()
    const todo = { kind: 'snapshot' as const, done: 0, total: 1, active: 'Fixing login' }
    await service.register({ ...register, showTask: true })
    service.handle('s1', { type: 'todo', change: todo })
    service.handle('s1', { type: 'waiting', permission: true })
    expect(sent.at(-1)?.props.task).toBe('Fixing login')
    // The background registration of a push-started activity carries no choice: it stays on.
    await service.register(register)
    expect(sent.at(-1)?.props.task).toBe('Fixing login')
    await service.register({ ...register, showTask: false })
    expect(sent.at(-1)?.props.task).toBe('')
    expect(sent.at(-1)?.props.notifiedAt).toBe(1_000)
  })

  test('passes androidDataMessages of the registration to every update', async () => {
    const { service, sent } = setup()
    const android = { sessionId: 's1', platform: 'android' as const, fcmToken: 'fcm' }
    await service.register({ ...android, androidDataMessages: true })
    service.handle('s1', { type: 'waiting', permission: true })
    expect(sent.map((m) => m.androidDataMessages)).toEqual([true, true])
    await service.register({ ...android, sessionId: 's2' })
    expect(sent.at(-1)).not.toHaveProperty('androidDataMessages')
  })

  test('sends the state on register, throttles steps and ends 15 minutes after Stop', async () => {
    vi.useFakeTimers()
    const { service, sent, unfollow, emit, advance } = setup()
    await service.register(register)
    expect(sent.map((m) => [m.event, m.props.state])).toEqual([['update', 'working']])

    emit({ type: 'step', step: 'command', tool: 'Bash' })
    emit({ type: 'step', step: 'editing', tool: 'Edit' })
    expect(sent).toHaveLength(1)
    advance(STEP_INTERVAL_MS)
    expect(sent.at(-1)?.props).toMatchObject({ step: 'editing files', tools: '2 tools' })

    service.handle('s1', { type: 'waiting', permission: true })
    expect(sent.at(-1)?.props.state).toBe('waiting')

    service.handle('s1', { type: 'stop' })
    // Done is an update: the activity stays, and so does the registration.
    expect(sent.at(-1)).toMatchObject({ event: 'update', props: { state: 'done', hint: 'total' } })
    expect(service.has('s1')).toBe(true)
    advance(DONE_DISMISS_MS - 1)
    expect(sent.at(-1)?.event).toBe('update')
    advance(1)
    await vi.runAllTimersAsync()
    const last = sent.at(-1)!
    expect(last).toMatchObject({ event: 'end', props: { state: 'done' } })
    expect(last.dismissAt).toBe(last.at)
    expect(service.has('s1')).toBe(false)
    expect(unfollow).toHaveBeenCalled()
  })

  test('a new turn within the done window updates the same activity and is not ended', async () => {
    vi.useFakeTimers()
    const { service, sent, advance } = setup()
    await service.register(register)
    service.handle('s1', { type: 'stop' })
    advance(5 * 60_000)
    service.handle('s1', { type: 'prompt' })
    expect(sent.at(-1)).toMatchObject({ event: 'update', activityToken: 'act', props: { state: 'working' } })
    advance(DONE_DISMISS_MS)
    await vi.runAllTimersAsync()
    expect(sent.some((m) => m.event === 'end')).toBe(false)
    expect(service.has('s1')).toBe(true)
  })

  test('re-registering a finished turn keeps it done and its window', async () => {
    vi.useFakeTimers()
    const { service, sent, advance } = setup()
    await service.register(register)
    service.handle('s1', { type: 'stop' })
    advance(10 * 60_000)
    // The app adopted the activity again after a restart.
    await service.register(register)
    expect(sent.at(-1)).toMatchObject({ event: 'update', props: { state: 'done' } })
    advance(5 * 60_000)
    await vi.runAllTimersAsync()
    expect(sent.at(-1)?.event).toBe('end')
  })

  test('the task count comes with the registration and follows the session', async () => {
    vi.useFakeTimers()
    const tasks = { subagents: 1, background: 1 }
    const { service, sent, advance } = setup({ tasks })
    await service.register(register)
    expect(sent.at(-1)?.props.tasks).toBe('1 subagent · 1 background task')
    service.handle('s1', { type: 'tasks', counts: { subagents: 0, background: 0 } })
    advance(STEP_INTERVAL_MS)
    expect(sent.at(-1)?.props.tasks).toBe('')
  })

  test('a closed session still ends at once', async () => {
    const { service, sent } = setup()
    await service.register(register)
    service.handle('s1', { type: 'end' })
    await Promise.resolve()
    expect(sent.at(-1)).toMatchObject({ event: 'end', props: { state: 'closed' } })
    expect(sent.at(-1)?.dismissAt).toBe(sent.at(-1)?.at)
    expect(service.has('s1')).toBe(false)
  })

  test('muted sessions get an immediate end and no more updates', async () => {
    const { service, sent } = setup({ muted: true })
    await service.register(register)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ event: 'end' })
    expect(sent[0]?.dismissAt).toBe(sent[0]?.at)
    service.handle('s1', { type: 'stop' })
    expect(sent).toHaveLength(1)
  })

  test('drops registrations whose token FCM rejects, and unregister stops updates', async () => {
    const rejected = setup({ invalid: true })
    await rejected.service.register(register)
    expect(rejected.service.has('s1')).toBe(false)

    const { service, sent, unfollow } = setup()
    await service.register(register)
    service.unregister('s1')
    service.handle('s1', { type: 'stop' })
    expect(sent).toHaveLength(1)
    expect(unfollow).toHaveBeenCalled()
  })

  test('a new registration during a turn keeps its status and the latest tokens', async () => {
    const { service, sent, emit } = setup()
    await service.register(register)
    emit({ type: 'step', step: 'command', tool: 'Bash' })
    await service.register({ ...register, activityToken: 'act2' })
    expect(sent.at(-1)).toMatchObject({ activityToken: 'act2', props: { tools: '1 tool' } })
  })
})
