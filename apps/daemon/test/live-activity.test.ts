import { describe, expect, test } from 'vitest'
import { messagesFor } from '../src/core/i18n/index.ts'
import { activityKind } from '../src/features/live-status/activity.ts'
import {
  activityText,
  applyTodo,
  initialLiveStatus,
  type LiveStatus,
  liveProps,
  reduceLiveStatus,
  taskLine,
  todoChange,
} from '../src/features/live-status/status.ts'

const bash = (command: string) => activityKind('Bash', { command })

describe('activityKind: the fixed phrase table', () => {
  test('Read of docs reads docs; other reads and searches explore the code', () => {
    expect(activityKind('Read', { file_path: '/w/app/README.md' })).toBe('readingDocs')
    expect(activityKind('Read', { file_path: '/w/app/docs/setup.ts' })).toBe('readingDocs')
    expect(activityKind('Read', { file_path: '/w/app/src/login.ts' })).toBe('exploring')
    expect(activityKind('Grep', { pattern: 'secret' })).toBe('exploring')
    expect(activityKind('Glob', { pattern: '**/*.ts' })).toBe('exploring')
  })

  test('WebFetch of a docs host reads docs; other web tools research', () => {
    expect(activityKind('WebFetch', { url: 'https://docs.expo.dev/x' })).toBe('readingDocs')
    expect(activityKind('WebFetch', { url: 'https://example.com/docs/api' })).toBe('readingDocs')
    expect(activityKind('WebFetch', { url: 'https://example.com/blog' })).toBe('researching')
    expect(activityKind('WebSearch', { query: 'x' })).toBe('researching')
  })

  test('edits: scripts, PDFs, then code', () => {
    expect(activityKind('Edit', { file_path: '/w/deploy.sh' })).toBe('updatingScripts')
    expect(activityKind('Write', { file_path: '/w/scripts/release.ts' })).toBe('updatingScripts')
    expect(activityKind('Edit', { file_path: '/w/Makefile' })).toBe('updatingScripts')
    expect(activityKind('Write', { file_path: '/w/out/report.pdf' })).toBe('creatingPdf')
    expect(activityKind('MultiEdit', { file_path: '/w/src/App.tsx' })).toBe('editingCode')
  })

  test('commands by program and subcommand', () => {
    expect(bash('git commit -m "x"')).toBe('committing')
    expect(bash('git add . && git push origin main')).toBe('committing')
    expect(bash('gh pr create --fill')).toBe('committing')
    expect(bash('git status')).toBe('command')
    expect(bash('pnpm vitest run src/login.test.ts')).toBe('testing')
    expect(bash('cd app && pnpm test')).toBe('testing')
    expect(bash('npx jest')).toBe('testing')
    expect(bash('go test ./...')).toBe('testing')
    expect(bash('pytest -q')).toBe('testing')
    expect(bash('pnpm --filter daemon build')).toBe('building')
    expect(bash('cargo build --release')).toBe('building')
    expect(bash('xcodebuild -scheme App build')).toBe('building')
    expect(bash('pnpm install --frozen-lockfile')).toBe('installing')
    expect(bash('npm i lodash')).toBe('installing')
    expect(bash('pip install requests')).toBe('installing')
    expect(bash('pandoc notes.md -o notes.pdf')).toBe('creatingPdf')
    expect(bash('ls -la')).toBe('command')
    expect(bash('')).toBe('command')
  })

  test('agents, plans and anything else', () => {
    expect(activityKind('Task', { subagent_type: 'Explore' })).toBe('delegating')
    expect(activityKind('Agent', {})).toBe('delegating')
    expect(activityKind('TodoWrite', { todos: [] })).toBe('planning')
    expect(activityKind('mcp__github__create_issue', { title: 'secret' })).toBe('tool')
  })
})

describe('phrase and current task in the props', () => {
  const en = messagesFor('en-US').live
  const pt = messagesFor('pt-BR').live
  const info = { title: 'Work', host: 'mac', session: 'Fix login', path: '~/app' }
  const working = (patch: Partial<LiveStatus> = {}): LiveStatus => ({ ...initialLiveStatus(1), ...patch })

  test('the phrase is translated; delegating counts the running agents; done is Finished', () => {
    expect(activityText(working({ activity: 'testing' }), en)).toBe('Running tests…')
    expect(activityText(working({ activity: 'testing' }), pt)).toBe('Rodando testes…')
    expect(activityText(working({ activity: 'delegating' }), en)).toBe('Delegating to 1 agent…')
    expect(
      activityText(working({ activity: 'delegating', tasks: { subagents: 2, background: 0 } }), en),
    ).toBe('Delegating to 2 agents…')
    expect(activityText(working({ activity: 'testing', state: 'done' }), en)).toBe('Finished')
    expect(activityText(working({ activity: 'testing', state: 'closed' }), en)).toBe('')
    expect(activityText(working(), en)).toBe('')
  })

  test('steps set the phrase; a step without one keeps it', () => {
    let status = reduceLiveStatus(
      working(),
      { type: 'step', step: 'command', tool: 'Bash', activity: 'testing' },
      2,
    )
    status = reduceLiveStatus(status, { type: 'step', step: 'tool', tool: 'X' }, 3)
    expect(status.activity).toBe('testing')
  })

  test('the task is sent only when opted in, while working or waiting', () => {
    const todo = applyTodo(null, {
      kind: 'snapshot',
      done: 0,
      total: 2,
      active: 'Implementing the login screen',
    })
    const status = working({ todo })
    expect(liveProps(status, info, en).task).toBe('')
    expect(liveProps(status, info, en, { showTask: true }).task).toBe('Implementing the login screen')
    expect(taskLine({ ...status, state: 'waiting' }, true)).toBe('Implementing the login screen')
    expect(taskLine({ ...status, state: 'done' }, true)).toBe('')
  })

  test('TodoWrite: the in-progress item’s activeForm, on one line and clipped to 48', () => {
    const long = 'Implementing the login screen with the new rate limit rules'
    const change = todoChange('TodoWrite', {
      todos: [
        { content: 'a', status: 'completed', activeForm: 'Doing a' },
        { content: 'b', status: 'in_progress', activeForm: `${long}\n  now` },
      ],
    })
    const active = applyTodo(null, change ?? { kind: 'created' })?.active ?? ''
    expect(active).toHaveLength(48)
    expect(active.endsWith('…')).toBe(true)
    expect(active).not.toContain('\n')
    const plain = todoChange('TodoWrite', { todos: [{ content: 'Fix it', status: 'in_progress' }] })
    expect(plain).toMatchObject({ active: 'Fix it' })
  })

  test('TaskCreate / TaskUpdate: the task in progress, cleared when it completes', () => {
    let todo = applyTodo(
      null,
      todoChange('TaskCreate', { subject: 'Login', activeForm: 'Building login' }) ?? { kind: 'created' },
    )
    todo = applyTodo(
      todo,
      todoChange('TaskCreate', { subject: 'Tests', activeForm: 'Writing tests' }) ?? { kind: 'created' },
    )
    expect(todo?.active).toBeNull()
    todo = applyTodo(
      todo,
      todoChange('TaskUpdate', { taskId: '2', status: 'in_progress' }) ?? { kind: 'created' },
    )
    expect(todo?.active).toBe('Writing tests')
    todo = applyTodo(
      todo,
      todoChange('TaskUpdate', { taskId: '1', status: 'completed' }) ?? { kind: 'created' },
    )
    expect(todo?.active).toBe('Writing tests')
    todo = applyTodo(
      todo,
      todoChange('TaskUpdate', { taskId: '2', status: 'completed' }) ?? { kind: 'created' },
    )
    expect(todo).toMatchObject({ active: null, done: 2, total: 2 })
  })

  test('props carry notifiedAt, the link and the translated labels', () => {
    const props = liveProps(working(), { ...info, link: 'claude-remote://session/s1' }, pt, { notifiedAt: 5 })
    expect(props).toMatchObject({
      notifiedAt: 5,
      link: 'claude-remote://session/s1',
      labels: { working: 'trabalhando', total: 'total', open: 'Abrir' },
    })
  })
})
