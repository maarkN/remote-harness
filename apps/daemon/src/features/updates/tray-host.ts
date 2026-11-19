import type { Logger } from '../../core/logger.ts'
import type { TrayProcess } from '../../infra/tray-helper.ts'
import type { TrayMenu } from './menu.ts'

/** What the running helper can draw besides the menu. */
export type HelperSupport = {
  windows: boolean
  popover: boolean
  /** It opens a session's terminal window (#614). */
  terminals: boolean
}

const MAX_RESTARTS = 3
const RESTART_DELAY_MS = 30_000

/**
 * Keeps the tray helper running with the latest menu. A helper that dies right away (no toolkit,
 * no display) leaves the daemon headless; a later crash is retried a few times; "Quit" stops it.
 */
export class TrayHost {
  private process: TrayProcess | null = null
  private menu: TrayMenu | null = null
  private restarts = 0
  private stopped = false
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly start: () => Promise<TrayProcess | null>,
    private readonly onClick: (id: string, value?: string) => void,
    private readonly logger: Logger,
    private readonly restartDelayMs = RESTART_DELAY_MS,
    /**
     * The helper reported `{type:'ready', windows, popover}`: whether it can open the Preferences/Sessions
     * windows and whether it shows the popover instead of the menu.
     */
    private readonly onReady: (support: HelperSupport) => void = () => {},
    /** `terminal.ready` / `terminal.input` / `terminal.closed` from a session's terminal window. */
    private readonly onTerminal: (message: Record<string, unknown>) => void = () => {},
  ) {}

  get running(): boolean {
    return this.process !== null
  }

  async launch(): Promise<void> {
    if (this.stopped || this.process) return
    const process = await this.start().catch((error: Error) => {
      this.logger.warn({ err: error }, 'tray helper could not start')
      return null
    })
    if (!process) return
    if (this.stopped) {
      process.stop()
      return
    }
    this.process = process
    process.onMessage((message) => {
      if (!message || typeof message !== 'object') return
      const { type, id, value, windows, popover, terminals } = message as {
        type?: unknown
        id?: unknown
        value?: unknown
        windows?: unknown
        popover?: unknown
        terminals?: unknown
      }
      if (type === 'click' && typeof id === 'string')
        this.onClick(id, typeof value === 'string' ? value : undefined)
      else if (type === 'ready')
        this.onReady({ windows: windows === true, popover: popover === true, terminals: terminals === true })
      else if (typeof type === 'string' && type.startsWith('terminal.'))
        this.onTerminal(message as Record<string, unknown>)
    })
    process.onExit((code, early) => {
      this.process = null
      if (this.stopped) return
      if (early) {
        this.logger.info({ code }, 'tray unavailable, running headless')
        return
      }
      if (this.restarts >= MAX_RESTARTS) return
      this.restarts += 1
      this.logger.warn({ code, attempt: this.restarts }, 'tray helper exited, restarting')
      this.timer = setTimeout(() => void this.launch(), this.restartDelayMs * this.restarts)
      this.timer.unref()
    })
    if (this.menu) process.send(this.menu)
  }

  update(menu: TrayMenu): void {
    this.menu = menu
    this.process?.send(menu)
  }

  /** A message to the running helper (a terminal window's); dropped while none runs. */
  send(message: object): void {
    this.process?.send(message)
  }

  /** A desktop notification shown by the helper (the Windows one); dropped while none runs. */
  notify(title: string, body: string): void {
    this.process?.send({ type: 'notify', title, body })
  }

  stop(): void {
    this.stopped = true
    clearTimeout(this.timer)
    this.process?.stop()
    this.process = null
  }
}
