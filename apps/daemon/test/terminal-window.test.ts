import type { ServerMessage } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { silentLogger } from '../src/core/logger.ts'
import type { PaneViewer } from '../src/features/pane/streamer.ts'
import { TERMINAL_THEMES, terminalPageHtml } from '../src/features/updates/terminal-page.ts'
import { type TerminalSession, TerminalWindows } from '../src/features/updates/terminal-windows.ts'
import { readXtermAssets } from '../src/infra/tray-helper.ts'

describe('terminal window page (#614)', () => {
  const page = terminalPageHtml({ js: '/*xterm.js*/', css: '/*xterm.css*/' })

  test('embeds the xterm assets and nothing from the network', () => {
    expect(page).toContain('/*xterm.js*/')
    expect(page).toContain('/*xterm.css*/')
    expect(page).toContain(`Content-Security-Policy`)
    expect(page).toContain(`default-src 'none'`)
    expect(page).not.toMatch(/<script[^>]+src=/)
  })

  test('takes input and reports it, with the frame writer the daemon calls', () => {
    expect(page).toContain('term.onData(')
    expect(page).toContain('window.webkit.messageHandlers.terminal.postMessage')
    expect(page).toContain(`type: 'input'`)
    expect(page).toContain(`type: 'ready'`)
    expect(page).toContain('window.writeFrame = function')
    expect(page).not.toContain('disableStdin: true')
  })

  test('both palettes of the app, switched by the system appearance', () => {
    expect(page).toContain('prefers-color-scheme: dark')
    expect(TERMINAL_THEMES.dark).toMatchObject({
      background: '#0D0D0D',
      foreground: '#E8E6E3',
      red: '#E06C75',
    })
    expect(TERMINAL_THEMES.light).toMatchObject({
      background: '#F3F3F1',
      foreground: '#1B1A19',
      red: '#C0392B',
    })
    expect(page).toContain(JSON.stringify(TERMINAL_THEMES))
  })

  test('the installed @xterm/xterm is found', async () => {
    const assets = await readXtermAssets()
    expect(assets.js).toContain('Terminal')
    expect(assets.css).toContain('.xterm')
  })
})

describe('TerminalWindows (#614)', () => {
  function setup() {
    const sessions = new Map<string, TerminalSession>([
      ['s1', { title: 'Fix login', paneId: '%3', controllable: true, state: 'running' }],
      ['out', { title: 'Plain claude', paneId: null, controllable: false, state: 'running' }],
    ])
    const sent: Array<Record<string, unknown>> = []
    const subscribed: Array<{ sessionId: string; paneId: string; viewer: PaneViewer; closed: boolean }> = []
    const typed: Array<[string, string]> = []
    const refreshed: string[] = []
    let pages = 0
    const windows = new TerminalWindows({
      send: (message) => sent.push(message as Record<string, unknown>),
      session: (id) => sessions.get(id),
      page: async () => {
        pages += 1
        return '/data/tray/terminal.html'
      },
      subscribe: (sessionId, paneId, viewer) => {
        const entry = { sessionId, paneId, viewer, closed: false }
        subscribed.push(entry)
        viewer.onClose(() => {
          entry.closed = true
        })
      },
      type: async (sessionId, data) => {
        typed.push([sessionId, data])
      },
      refresh: (sessionId) => refreshed.push(sessionId),
      logger: silentLogger,
    })
    return { windows, sessions, sent, subscribed, typed, refreshed, pages: () => pages }
  }
  const frame = (text: string): ServerMessage => ({
    type: 'pane.frame',
    sessionId: 's1',
    text,
    cols: 20,
    rows: 3,
  })

  test('show opens or raises the window of a tmux session, writing the page once', async () => {
    const { windows, sent, pages } = setup()
    expect(await windows.show('s1')).toBe(true)
    expect(await windows.show('s1')).toBe(true)
    expect(sent).toEqual([
      { type: 'terminal.open', sessionId: 's1', title: 'Fix login', page: '/data/tray/terminal.html' },
      { type: 'terminal.open', sessionId: 's1', title: 'Fix login', page: '/data/tray/terminal.html' },
    ])
    expect(pages()).toBe(1)
  })

  test('a session without a pane opens nothing', async () => {
    const { windows, sent } = setup()
    expect(await windows.show('out')).toBe(false)
    expect(await windows.show('nope')).toBe(false)
    expect(sent).toEqual([])
  })

  test('a ready page gets the stream: a full frame first, then the changed rows', async () => {
    const { windows, sent, subscribed } = setup()
    await windows.show('s1')
    windows.onHelperMessage({ type: 'terminal.ready', sessionId: 's1' })
    expect(subscribed).toMatchObject([{ sessionId: 's1', paneId: '%3' }])
    const viewer = subscribed[0]!.viewer
    viewer.send(frame('a\nb\nc'))
    viewer.send({ type: 'pane.diff', sessionId: 's1', cols: 20, rows: 3, lineCount: 3, lines: [[1, 'B']] })
    viewer.send(frame('a\nB\nc'))
    expect(sent.slice(1)).toEqual([
      { type: 'terminal.frame', sessionId: 's1', write: { full: true, cols: 20, rows: 3, data: 'a\nb\nc' } },
      {
        type: 'terminal.frame',
        sessionId: 's1',
        write: { full: false, cols: 20, rows: 3, data: '\u001b[2;1H\u001b[0m\u001b[2KB\u001b[0m' },
      },
    ])
    // A page that loads again (a reload) starts over with a full frame.
    windows.onHelperMessage({ type: 'terminal.ready', sessionId: 's1' })
    expect(subscribed[0]?.closed).toBe(true)
    subscribed[1]!.viewer.send(frame('a\nB\nc'))
    expect(sent.at(-1)).toMatchObject({ type: 'terminal.frame', write: { full: true } })
  })

  test('what is typed reaches the session and the stream refreshes', async () => {
    const { windows, typed, refreshed } = setup()
    await windows.show('s1')
    windows.onHelperMessage({ type: 'terminal.input', sessionId: 's1', data: '/help\r' })
    windows.onHelperMessage({ type: 'terminal.input', sessionId: 's1', data: 42 })
    windows.onHelperMessage({ type: 'terminal.input', sessionId: 'unknown', data: 'x' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(typed).toEqual([['s1', '/help\r']])
    expect(refreshed).toEqual(['s1'])
  })

  test('closing the window stops its stream; a later input is ignored', async () => {
    const { windows, subscribed, typed } = setup()
    await windows.show('s1')
    windows.onHelperMessage({ type: 'terminal.ready', sessionId: 's1' })
    windows.onHelperMessage({ type: 'terminal.closed', sessionId: 's1' })
    expect(subscribed[0]?.closed).toBe(true)
    windows.onHelperMessage({ type: 'terminal.input', sessionId: 's1', data: 'x' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(typed).toEqual([])
  })

  test('the window follows a rename, and closes when the session ends', async () => {
    const { windows, sessions, sent, subscribed } = setup()
    await windows.show('s1')
    windows.onHelperMessage({ type: 'terminal.ready', sessionId: 's1' })
    sessions.set('s1', { title: 'Fix login on Safari', paneId: '%3', controllable: true, state: 'idle' })
    windows.sessionChanged('s1')
    windows.sessionChanged('s1')
    sessions.set('s1', { title: 'Fix login on Safari', paneId: null, controllable: false, state: 'ended' })
    windows.sessionChanged('s1')
    expect(sent.slice(1)).toEqual([
      { type: 'terminal.title', sessionId: 's1', title: 'Fix login on Safari' },
      { type: 'terminal.close', sessionId: 's1' },
    ])
    expect(subscribed[0]?.closed).toBe(true)
  })

  test('a new helper process drops every window and its stream', async () => {
    const { windows, subscribed, sent } = setup()
    await windows.show('s1')
    windows.onHelperMessage({ type: 'terminal.ready', sessionId: 's1' })
    windows.reset()
    expect(subscribed[0]?.closed).toBe(true)
    windows.sessionChanged('s1')
    expect(sent).toHaveLength(1)
  })
})
