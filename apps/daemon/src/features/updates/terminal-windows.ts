import {
  applyPaneDiff,
  type FrameWrite,
  frameWrite,
  type PaneFrame,
  type ServerMessage,
  type SessionState,
} from '@remote-harness/protocol'
import type { Logger } from '../../core/logger.ts'
import type { PaneViewer } from '../pane/streamer.ts'

/** What a session's terminal window needs to know about it. */
export type TerminalSession = {
  title: string
  paneId: string | null
  controllable: boolean
  state: SessionState
}

export type TerminalWindowsDeps = {
  /** A message to the tray helper (its stdin). */
  send: (message: object) => void
  session: (sessionId: string) => TerminalSession | undefined
  /** Writes the window's page and returns its path (called once while it succeeds). */
  page: () => Promise<string>
  /** The pane stream the app gets (`PaneStreamer.subscribe`). */
  subscribe: (sessionId: string, paneId: string, viewer: PaneViewer) => void
  /** Types what the window sent into the pane (`InputService.typeRaw`). */
  type: (sessionId: string, data: string) => Promise<void>
  /** A frame right away, for the echo of what was typed (`PaneStreamer.refresh`). */
  refresh: (sessionId: string) => void
  logger: Logger
}

/** One window's view of the pane stream: turns `pane.frame` / `pane.diff` into page writes. */
class WindowViewer implements PaneViewer {
  /** The stream's latest frame, which the next diff applies to. */
  private last: PaneFrame | null = null
  /** What the page shows. */
  private drawn: PaneFrame | null = null
  private readonly closers: Array<() => void> = []

  constructor(
    readonly paneId: string,
    private readonly write: (write: FrameWrite) => void,
  ) {}

  send(message: ServerMessage): void {
    let next: PaneFrame
    if (message.type === 'pane.frame') next = { text: message.text, cols: message.cols, rows: message.rows }
    else if (message.type === 'pane.diff' && this.last) next = applyPaneDiff(this.last, message)
    else return
    this.last = next
    const write = frameWrite(this.drawn, next)
    this.drawn = next
    if (write.full || write.data !== '') this.write(write)
  }

  onClose(fn: () => void): void {
    this.closers.push(fn)
  }

  /** The window went away: the streamer drops this viewer. */
  close(): void {
    for (const fn of this.closers.splice(0)) fn()
  }
}

type OpenWindow = { title: string; viewer: WindowViewer | null }

function hasPane(session: TerminalSession | undefined): session is TerminalSession & { paneId: string } {
  return Boolean(session?.controllable && session.paneId && session.state !== 'ended')
}

/**
 * The computer's terminal windows (#614): one per session, opened by the macOS tray helper, fed the
 * pane stream over its stdin and typing into the pane what it reports on its stdout.
 */
export class TerminalWindows {
  private readonly windows = new Map<string, OpenWindow>()
  private page: Promise<string> | null = null

  constructor(private readonly deps: TerminalWindowsDeps) {}

  /** Opens the session's window, or brings it to the front; false when the session has no pane. */
  async show(sessionId: string): Promise<boolean> {
    const session = this.deps.session(sessionId)
    if (!hasPane(session)) return false
    this.page ??= this.deps.page().catch((error: unknown) => {
      this.page = null
      throw error
    })
    const page = await this.page
    if (!this.windows.has(sessionId)) this.windows.set(sessionId, { title: session.title, viewer: null })
    this.deps.send({ type: 'terminal.open', sessionId, title: session.title, page })
    return true
  }

  /** `terminal.ready` / `terminal.input` / `terminal.closed` from the helper. */
  onHelperMessage(message: { type?: unknown; sessionId?: unknown; data?: unknown }): void {
    const { type, sessionId, data } = message
    if (typeof sessionId !== 'string') return
    const window = this.windows.get(sessionId)
    if (!window) return
    if (type === 'terminal.ready') this.attach(sessionId, window)
    else if (type === 'terminal.input' && typeof data === 'string') {
      // What is typed is never logged, only that it could not be delivered.
      this.deps
        .type(sessionId, data)
        .then(() => this.deps.refresh(sessionId))
        .catch((error: unknown) =>
          this.deps.logger.warn({ err: error, sessionId }, 'terminal window input failed'),
        )
    } else if (type === 'terminal.closed') {
      window.viewer?.close()
      this.windows.delete(sessionId)
    }
  }

  /** A session changed: its window follows the title and the pane, and closes once there is no pane. */
  sessionChanged(sessionId: string): void {
    const window = this.windows.get(sessionId)
    if (!window) return
    const session = this.deps.session(sessionId)
    if (!hasPane(session)) {
      window.viewer?.close()
      this.windows.delete(sessionId)
      this.deps.send({ type: 'terminal.close', sessionId })
      return
    }
    if (session.title !== window.title) {
      window.title = session.title
      this.deps.send({ type: 'terminal.title', sessionId, title: session.title })
    }
    if (window.viewer && window.viewer.paneId !== session.paneId) this.attach(sessionId, window)
  }

  /** A new helper process has no windows: drop the old ones and their streams. */
  reset(): void {
    for (const window of this.windows.values()) window.viewer?.close()
    this.windows.clear()
  }

  /** A (re)loaded page starts over: a new viewer gets a full frame first. */
  private attach(sessionId: string, window: OpenWindow): void {
    window.viewer?.close()
    window.viewer = null
    const session = this.deps.session(sessionId)
    if (!hasPane(session)) return
    const viewer = new WindowViewer(session.paneId, (write) =>
      this.deps.send({ type: 'terminal.frame', sessionId, write }),
    )
    window.viewer = viewer
    this.deps.subscribe(sessionId, session.paneId, viewer)
  }
}
