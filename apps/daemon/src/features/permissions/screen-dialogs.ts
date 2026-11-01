import type { SessionState } from '@remote-harness/protocol'
import type { ApprovalDialog } from '../agents/index.ts'

/** How often the panes of running sessions are checked for an approval dialog. */
export const SCREEN_DIALOG_POLL_MS = 1_000

/** What the watcher needs to know about a session. */
export type WatchedSession = {
  id: string
  profileId: string
  paneId: string | null
  state: SessionState
  controllable: boolean
}

export type ScreenDialogDeps = {
  sessions(): readonly WatchedSession[]
  /** The session's dialog when its agent's dialog is found on screen; null otherwise. */
  dialogOf(session: WatchedSession): ApprovalDialog | null
  capture(paneId: string): Promise<string>
  /** Opens a request for a dialog now on screen; returns its id. */
  open(session: WatchedSession, dialog: ApprovalDialog, screen: string): Promise<string>
  isPending(requestId: string): boolean
  /** The dialog went away (or was replaced) without the phone: answered in the terminal. */
  gone(requestId: string): void
}

const WATCHED_STATES: ReadonlySet<SessionState> = new Set(['running', 'waiting'])

/**
 * Finds the approval dialogs no hook announces (Kimi CLI) by reading the panes of running sessions:
 * a dialog that shows opens a request, one that goes away or is replaced resolves it. Each dialog
 * is told apart by `ApprovalDialog.identify`, which typing checks again before pressing a key.
 */
export class ScreenDialogWatcher {
  /** The open request of each session and the dialog it is for. */
  private readonly open = new Map<string, { requestId: string; identity: string }>()
  /** A dialog the phone already answered that may still be on screen for a moment. */
  private readonly answered = new Map<string, string>()
  private ticking = false

  constructor(private readonly deps: ScreenDialogDeps) {}

  /** The dialog a request was opened for (checked before typing an answer into it). */
  identityOf(requestId: string): string | undefined {
    for (const entry of this.open.values()) if (entry.requestId === requestId) return entry.identity
    return undefined
  }

  async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      const watched = new Set<string>()
      for (const session of this.deps.sessions()) {
        const dialog = this.deps.dialogOf(session)
        if (!dialog || !session.paneId || !session.controllable || !WATCHED_STATES.has(session.state))
          continue
        watched.add(session.id)
        const screen = await this.deps.capture(session.paneId).catch(() => null)
        if (screen === null) continue
        await this.check(session, dialog, screen)
      }
      for (const [sessionId, entry] of [...this.open]) {
        if (watched.has(sessionId)) continue
        this.open.delete(sessionId)
        if (this.deps.isPending(entry.requestId)) this.deps.gone(entry.requestId)
      }
      for (const sessionId of [...this.answered.keys()])
        if (!watched.has(sessionId)) this.answered.delete(sessionId)
    } finally {
      this.ticking = false
    }
  }

  private async check(session: WatchedSession, dialog: ApprovalDialog, screen: string): Promise<void> {
    const identity = dialog.isOpen(screen) ? dialog.identify(screen) : null
    const current = this.open.get(session.id)
    if (current && !this.deps.isPending(current.requestId)) {
      // Answered (from the phone or by the session moving on): the dialog may linger for a moment.
      this.open.delete(session.id)
      this.answered.set(session.id, current.identity)
    }
    const open = this.open.get(session.id)
    if (identity === null) {
      this.answered.delete(session.id)
      if (open) {
        this.open.delete(session.id)
        this.deps.gone(open.requestId)
      }
      return
    }
    if (open?.identity === identity || this.answered.get(session.id) === identity) return
    this.answered.delete(session.id)
    if (open) {
      this.open.delete(session.id)
      this.deps.gone(open.requestId)
    }
    const requestId = await this.deps.open(session, dialog, screen)
    this.open.set(session.id, { requestId, identity })
  }
}
