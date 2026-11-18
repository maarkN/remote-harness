import { describe, expect, test } from 'vitest'
import { showInTerminal } from '../src/features/pane/show-in-terminal.ts'
import {
  attachCommand,
  installedTerminalApps,
  pickTerminalApp,
  planShowInTerminal,
  shellQuote,
  terminalFallback,
} from '../src/features/pane/terminal-focus.ts'
import { createDesktop } from '../src/infra/desktop.ts'
import { resolveTmuxBin, TMUX_LOCATIONS, TmuxClient } from '../src/infra/tmux.ts'
import { fakeExecutor } from './helpers.ts'

describe('TmuxClient.listClients', () => {
  test('parses one client per line', async () => {
    const exec = fakeExecutor(() => ({ stdout: '/dev/ttys001\n/dev/ttys002\n' }))
    expect(await new TmuxClient(exec).listClients('%1')).toEqual([
      { tty: '/dev/ttys001' },
      { tty: '/dev/ttys002' },
    ])
    expect(exec.calls[0]?.args).toEqual(['list-clients', '-t', '%1', '-F', '#{client_tty}'])
  })

  test('is empty with no attached client', async () => {
    const exec = fakeExecutor(() => ({ stdout: '' }))
    expect(await new TmuxClient(exec).listClients('%1')).toEqual([])
  })

  test('is empty rather than an error when no tmux server runs', async () => {
    const exec = fakeExecutor(() => ({ exitCode: 1, stderr: 'no server running on /tmp/tmux-0/default' }))
    expect(await new TmuxClient(exec).listClients('%1')).toEqual([])
  })
})

describe('TmuxClient.switchClient', () => {
  test('switches the given client to the target', async () => {
    const exec = fakeExecutor()
    await new TmuxClient(exec).switchClient('/dev/ttys001', '%1')
    expect(exec.calls[0]?.args).toEqual(['switch-client', '-c', '/dev/ttys001', '-t', '%1'])
  })
})

describe('resolveTmuxBin', () => {
  const none = async () => false

  test('takes the absolute path `which tmux` prints', async () => {
    const exec = fakeExecutor(() => ({ stdout: '/opt/homebrew/bin/tmux\n' }))
    expect(await resolveTmuxBin(exec, none)).toBe('/opt/homebrew/bin/tmux')
    expect(exec.calls).toMatchObject([{ file: 'which', args: ['tmux'] }])
  })

  test('falls back to the first usual location that exists when `which` finds nothing', async () => {
    const exists = async (path: string) => path === '/usr/local/bin/tmux' || path === '/usr/bin/tmux'
    expect(
      await resolveTmuxBin(
        fakeExecutor(() => ({ exitCode: 1 })),
        exists,
      ),
    ).toBe('/usr/local/bin/tmux')
    // `which` printing nothing (or a bare name) counts as not found.
    expect(
      await resolveTmuxBin(
        fakeExecutor(() => ({ stdout: 'tmux\n' })),
        exists,
      ),
    ).toBe('/usr/local/bin/tmux')
    expect(TMUX_LOCATIONS[0]).toBe('/opt/homebrew/bin/tmux')
  })

  test('is null when tmux is nowhere', async () => {
    expect(
      await resolveTmuxBin(
        fakeExecutor(() => ({ exitCode: 1 })),
        none,
      ),
    ).toBeNull()
  })
})

describe('TmuxClient.absoluteBin', () => {
  test('looks the path up once', async () => {
    const exec = fakeExecutor(() => ({ stdout: '/opt/homebrew/bin/tmux\n' }))
    const tmux = new TmuxClient(exec)
    expect(await tmux.absoluteBin()).toBe('/opt/homebrew/bin/tmux')
    expect(await tmux.absoluteBin()).toBe('/opt/homebrew/bin/tmux')
    expect(exec.calls.filter((call) => call.file === 'which')).toHaveLength(1)
  })

  test('is the client binary itself when it is already absolute', async () => {
    const exec = fakeExecutor()
    expect(await new TmuxClient(exec, '/usr/bin/tmux').absoluteBin()).toBe('/usr/bin/tmux')
    expect(exec.calls).toEqual([])
  })

  test('keeps the bare name when no lookup finds tmux', async () => {
    const tmux = new TmuxClient(
      fakeExecutor(() => ({ exitCode: 1 })),
      'tmux',
      null,
      async () => false,
    )
    expect(await tmux.absoluteBin()).toBe('tmux')
  })
})

const TMUX = '/opt/homebrew/bin/tmux'

describe('attachCommand', () => {
  test('attaches and selects the pane for every clause, with tmux by its absolute path', () => {
    expect(attachCommand('%1', TMUX)).toBe(
      "'/opt/homebrew/bin/tmux' attach -t '%1' \\; select-window -t '%1' \\; select-pane -t '%1'",
    )
  })

  test('selects the Remote Harness server and its config when given one', () => {
    const server = { socket: 'remote-harness', conf: "/Users/it's/.remote-harness/tmux.conf" }
    expect(attachCommand('%1', TMUX, server)).toBe(
      `'/opt/homebrew/bin/tmux' -L 'remote-harness' -f '/Users/it'\\''s/.remote-harness/tmux.conf' attach -t '%1' \\; select-window -t '%1' \\; select-pane -t '%1'`,
    )
  })
})

describe('pickTerminalApp', () => {
  test('picks the highest-priority app that is running', () => {
    expect(pickTerminalApp(['Finder', 'WezTerm', 'iTerm2']).id).toBe('iterm2')
    expect(pickTerminalApp(['Finder', 'wezterm-gui']).id).toBe('wezterm')
  })

  test('falls back to Terminal.app when nothing else is running', () => {
    expect(pickTerminalApp([]).id).toBe('terminal')
    expect(pickTerminalApp(['Finder', 'Safari']).id).toBe('terminal')
  })
})

describe('planShowInTerminal', () => {
  const base = {
    wsl: false,
    hasAttachedClient: false,
    runningProcessNames: [] as string[],
    terminalEnv: null,
    paneId: '%1',
    tmuxBin: TMUX,
  }
  const cmd = attachCommand('%1', TMUX)

  test('darwin, no attached client: opens the detected app with the attach command', () => {
    const steps = planShowInTerminal({ ...base, platform: 'darwin', runningProcessNames: ['Ghostty'] })
    expect(steps).toEqual([{ file: 'open', args: ['-na', 'Ghostty', '--args', '-e', '/bin/sh', '-c', cmd] }])
  })

  test('darwin, attached client: activates the detected app instead of opening a window', () => {
    const steps = planShowInTerminal({
      ...base,
      platform: 'darwin',
      hasAttachedClient: true,
      runningProcessNames: ['kitty'],
    })
    expect(steps).toEqual([{ file: 'open', args: ['-a', 'kitty'] }])
  })

  test('linux, no attached client, $TERMINAL set: uses it over x-terminal-emulator', () => {
    const steps = planShowInTerminal({ ...base, platform: 'linux', terminalEnv: 'alacritty' })
    expect(steps).toEqual([{ file: 'alacritty', args: ['-e', '/bin/sh', '-c', `${cmd}; exec "$SHELL"`] }])
  })

  test('linux, no $TERMINAL: falls back to x-terminal-emulator', () => {
    const steps = planShowInTerminal({ ...base, platform: 'linux' })
    expect(steps[0]?.file).toBe('x-terminal-emulator')
  })

  test('the new terminal attaches to the Remote Harness server when the client uses one', () => {
    const tmuxServer = { socket: 'remote-harness', conf: '/h/.remote-harness/tmux.conf' }
    const steps = planShowInTerminal({ ...base, platform: 'linux', tmuxServer })
    expect(steps[0]?.args.at(-1)).toBe(`${attachCommand('%1', TMUX, tmuxServer)}; exec "$SHELL"`)
    expect(steps[0]?.args.at(-1)).toContain(
      "'/opt/homebrew/bin/tmux' -L 'remote-harness' -f '/h/.remote-harness/tmux.conf' attach",
    )
  })

  test('linux, attached client: nothing to run (no portable window-raise)', () => {
    expect(planShowInTerminal({ ...base, platform: 'linux', hasAttachedClient: true })).toEqual([])
  })

  test('wsl, no attached client: opens Windows Terminal over wsl.exe', () => {
    const steps = planShowInTerminal({ ...base, platform: 'linux', wsl: true })
    expect(steps).toEqual([{ file: 'wt.exe', args: ['wsl.exe', '/bin/sh', '-c', cmd] }])
  })

  test('darwin, iTerm2: runs the command through /bin/sh -c, quoted for the shell (#612)', () => {
    const steps = planShowInTerminal({ ...base, platform: 'darwin', runningProcessNames: ['iTerm2'] })
    const shell = `/bin/sh -c ${shellQuote(cmd)}`
    const script = `tell application id "com.googlecode.iterm2" to create window with default profile command "${shell.replaceAll('\\', '\\\\')}"`
    expect(steps).toEqual([{ file: 'osascript', args: ['-e', script] }])
    expect(script).toContain(`command "/bin/sh -c ''\\\\''/opt/homebrew/bin/tmux'\\\\'' attach`)
  })

  test('darwin, Terminal.app: do script runs /bin/sh -c', () => {
    const steps = planShowInTerminal({ ...base, platform: 'darwin' })
    expect(steps[0]?.args[1]).toBe(
      `tell application id "com.apple.Terminal" to do script "/bin/sh -c ${shellQuote(cmd).replaceAll('\\', '\\\\')}"`,
    )
  })

  test('every app and platform opens with /bin/sh -c and the absolute tmux path', () => {
    const apps = ['iTerm2', 'Ghostty', 'wezterm-gui', 'kitty', 'Alacritty', 'Terminal']
    const plans = [
      ...apps.map((app) => planShowInTerminal({ ...base, platform: 'darwin', runningProcessNames: [app] })),
      planShowInTerminal({ ...base, platform: 'linux' }),
      planShowInTerminal({ ...base, platform: 'linux', wsl: true }),
    ]
    for (const [step] of plans) {
      const line = step?.args.join(' ') ?? ''
      expect(line).toContain('/bin/sh -c')
      expect(line).toContain('/opt/homebrew/bin/tmux')
      expect(line).not.toMatch(/(^|[\s'"])tmux attach/)
    }
  })

  test('wsl, attached client: nothing to run', () => {
    expect(planShowInTerminal({ ...base, platform: 'linux', wsl: true, hasAttachedClient: true })).toEqual([])
  })
})

describe('the chosen terminal (#615)', () => {
  const base = {
    wsl: false,
    hasAttachedClient: false,
    terminalEnv: null,
    paneId: '%1',
    tmuxBin: TMUX,
  }
  const cmd = attachCommand('%1', TMUX)
  const ghostty = { file: 'open', args: ['-na', 'Ghostty', '--args', '-e', '/bin/sh', '-c', cmd] }

  test('a chosen app that is installed opens the session even while another app comes first', () => {
    const steps = planShowInTerminal({
      ...base,
      platform: 'darwin',
      runningProcessNames: ['iTerm2', 'Ghostty'],
      choice: 'ghostty',
      installed: ['iterm2', 'ghostty', 'terminal'],
    })
    expect(steps).toEqual([ghostty])
    // Not even running: it is started.
    expect(
      planShowInTerminal({
        ...base,
        platform: 'darwin',
        runningProcessNames: ['iTerm2'],
        choice: 'ghostty',
        installed: ['ghostty'],
      }),
    ).toEqual([ghostty])
  })

  test('with a client attached, the chosen app comes to the front when it runs, else the first running one', () => {
    const attached = {
      ...base,
      platform: 'darwin' as const,
      hasAttachedClient: true,
      choice: 'ghostty' as const,
      installed: ['ghostty' as const],
    }
    expect(planShowInTerminal({ ...attached, runningProcessNames: ['iTerm2', 'Ghostty'] })).toEqual([
      { file: 'open', args: ['-a', 'Ghostty'] },
    ])
    expect(planShowInTerminal({ ...attached, runningProcessNames: ['iTerm2'] })[0]?.args[1]).toContain(
      'iterm2',
    )
  })

  test('a chosen app that is not installed falls back to auto, and the fallback names both', () => {
    const missing = {
      ...base,
      platform: 'darwin' as const,
      runningProcessNames: ['iTerm2'],
      choice: 'alacritty' as const,
      installed: ['iterm2' as const, 'terminal' as const],
    }
    expect(planShowInTerminal(missing)).toEqual(planShowInTerminal({ ...missing, choice: 'auto' }))
    expect(terminalFallback(missing)).toEqual({ missing: 'Alacritty', used: 'iTerm2' })
    expect(terminalFallback({ ...missing, runningProcessNames: [] })).toEqual({
      missing: 'Alacritty',
      used: 'Terminal',
    })
    // Nothing to report when the app is there, nothing is chosen, or nothing opens.
    expect(terminalFallback({ ...missing, installed: ['alacritty'] })).toBeNull()
    expect(terminalFallback({ ...missing, choice: 'auto' })).toBeNull()
    expect(terminalFallback({ ...missing, hasAttachedClient: true })).toBeNull()
  })

  test('auto, window and no choice behave as before', () => {
    const running = ['Finder', 'Ghostty', 'iTerm2']
    const before = planShowInTerminal({ ...base, platform: 'darwin', runningProcessNames: running })
    for (const choice of ['auto', 'window', undefined] as const)
      expect(
        planShowInTerminal({
          ...base,
          platform: 'darwin',
          runningProcessNames: running,
          choice,
          installed: [],
        }),
      ).toEqual(before)
  })

  test('linux: a chosen app replaces $TERMINAL, each with its own way of taking a command', () => {
    const line = `${cmd}; exec "$SHELL"`
    const linux = { ...base, platform: 'linux' as const, runningProcessNames: [], terminalEnv: 'xterm' }
    expect(planShowInTerminal({ ...linux, choice: 'kitty', installed: ['kitty'] })).toEqual([
      { file: 'kitty', args: ['/bin/sh', '-c', line] },
    ])
    expect(planShowInTerminal({ ...linux, choice: 'ghostty', installed: ['ghostty'] })).toEqual([
      { file: 'ghostty', args: ['-e', '/bin/sh', '-c', line] },
    ])
    expect(planShowInTerminal({ ...linux, choice: 'alacritty', installed: ['alacritty'] })).toEqual([
      { file: 'alacritty', args: ['-e', '/bin/sh', '-c', line] },
    ])
    expect(planShowInTerminal({ ...linux, choice: 'wezterm', installed: ['wezterm'] })).toEqual([
      { file: 'wezterm', args: ['start', '--', '/bin/sh', '-c', line] },
    ])
    // Not installed: $TERMINAL as before, and the fallback says so.
    expect(planShowInTerminal({ ...linux, choice: 'kitty', installed: [] })).toEqual([
      { file: 'xterm', args: ['-e', '/bin/sh', '-c', line] },
    ])
    expect(terminalFallback({ ...linux, choice: 'kitty', installed: [] })).toEqual({
      missing: 'kitty',
      used: 'xterm',
    })
    expect(terminalFallback({ ...linux, terminalEnv: null, choice: 'kitty', installed: [] })).toEqual({
      missing: 'kitty',
      used: 'x-terminal-emulator',
    })
  })

  test('wsl keeps Windows Terminal whatever is chosen', () => {
    const wsl = { ...base, platform: 'linux' as const, wsl: true, runningProcessNames: [] }
    expect(planShowInTerminal({ ...wsl, choice: 'kitty', installed: ['kitty'] })).toEqual(
      planShowInTerminal(wsl),
    )
    expect(terminalFallback({ ...wsl, choice: 'kitty', installed: [] })).toBeNull()
  })
})

describe('showInTerminal (orchestration)', () => {
  test('switches every attached client, focuses the pane, then activates the running app', async () => {
    const exec = fakeExecutor((call) => {
      if (call.args[0] === 'list-clients') return { stdout: '/dev/ttys001\n/dev/ttys002\n' }
      if (call.file === 'which') return { stdout: `${TMUX}\n` }
      if (call.file === 'osascript' && call.args.some((a) => a.includes('System Events')))
        return { stdout: 'Finder, iTerm2, Safari' }
      return undefined
    })
    const tmux = new TmuxClient(exec)
    const desktop = createDesktop(exec, 'darwin', { wsl: false })
    await showInTerminal(tmux, desktop, 'darwin', false, '%1')
    expect(exec.calls.map((c) => c.args)).toEqual([
      ['list-clients', '-t', '%1', '-F', '#{client_tty}'],
      ['switch-client', '-c', '/dev/ttys001', '-t', '%1'],
      ['switch-client', '-c', '/dev/ttys002', '-t', '%1'],
      ['select-window', '-t', '%1'],
      ['select-pane', '-t', '%1'],
      ['-e', 'tell application "System Events" to get name of every process whose background only is false'],
      ['tmux'],
      ['-e', 'tell application id "com.googlecode.iterm2" to activate'],
    ])
  })

  test('opens a new window when nothing is attached, without switching any client', async () => {
    const exec = fakeExecutor((call) => {
      if (call.args[0] === 'list-clients') return { stdout: '' }
      if (call.file === 'which') return { stdout: `${TMUX}\n` }
      if (call.file === 'osascript' && call.args.some((a) => a.includes('System Events')))
        return { stdout: '' }
      return undefined
    })
    const tmux = new TmuxClient(exec)
    const desktop = createDesktop(exec, 'darwin', { wsl: false })
    await showInTerminal(tmux, desktop, 'darwin', false, '%1')
    const fileCalls = exec.calls.map((c) => c.file)
    expect(fileCalls).not.toContain('switch-client')
    const last = exec.calls[exec.calls.length - 1]
    expect(last?.file).toBe('osascript')
    expect(last?.args[1]).toContain('tell application id "com.apple.Terminal" to do script "/bin/sh -c')
    expect(last?.args[1]).toContain(TMUX)
  })

  test('propagates a failure instead of swallowing it', async () => {
    const exec = fakeExecutor((call) => {
      if (call.args[0] === 'list-clients') return { stdout: '' }
      if (call.file === 'osascript' && call.args.some((a) => a.includes('System Events')))
        return { stdout: '' }
      if (call.file === 'osascript') return { exitCode: 1, stderr: 'not authorized' }
      return undefined
    })
    const tmux = new TmuxClient(exec)
    const desktop = createDesktop(exec, 'darwin', { wsl: false })
    await expect(showInTerminal(tmux, desktop, 'darwin', false, '%1')).rejects.toThrow('not authorized')
  })

  test('the chosen app opens even while another runs, and a missing one is reported (#615)', async () => {
    const respond = (call: { file: string; args: readonly string[] }) => {
      if (call.args[0] === 'list-clients') return { stdout: '' }
      if (call.file === 'which') return { stdout: `${TMUX}\n` }
      if (call.file === 'osascript' && call.args.some((a) => a.includes('System Events')))
        return { stdout: 'Finder, iTerm2' }
      return undefined
    }
    const exec = fakeExecutor(respond)
    const desktop = createDesktop(exec, 'darwin', { wsl: false })
    const chosen = await showInTerminal(new TmuxClient(exec), desktop, 'darwin', false, '%1', {
      choice: 'ghostty',
      installed: async () => ['ghostty', 'iterm2', 'terminal'],
    })
    expect(chosen).toBeNull()
    expect(exec.calls.at(-1)?.file).toBe('open')
    expect(exec.calls.at(-1)?.args.slice(0, 6)).toEqual(['-na', 'Ghostty', '--args', '-e', '/bin/sh', '-c'])

    const other = fakeExecutor(respond)
    const missing = await showInTerminal(
      new TmuxClient(other),
      createDesktop(other, 'darwin', { wsl: false }),
      'darwin',
      false,
      '%1',
      {
        choice: 'alacritty',
        installed: async () => ['iterm2', 'terminal'],
      },
    )
    expect(missing).toEqual({ missing: 'Alacritty', used: 'iTerm2' })
    expect(other.calls.at(-1)?.args[1]).toContain('com.googlecode.iterm2')
  })
})

describe('installedTerminalApps (#615)', () => {
  test("macOS: the bundles in /Applications, ~/Applications and Terminal.app's system folder", async () => {
    const present = new Set([
      '/Applications/Ghostty.app',
      '/Users/me/Applications/kitty.app',
      '/System/Applications/Utilities/Terminal.app',
    ])
    const found = await installedTerminalApps({
      platform: 'darwin',
      wsl: false,
      home: '/Users/me',
      exists: async (path) => present.has(path),
      which: async () => false,
    })
    expect(found).toEqual(['ghostty', 'kitty', 'terminal'])
  })

  test('Linux: the binaries on PATH; nothing under WSL', async () => {
    const which = async (bin: string) => bin === 'kitty' || bin === 'wezterm'
    const exists = async () => true
    expect(await installedTerminalApps({ platform: 'linux', wsl: false, home: '/h', exists, which })).toEqual(
      ['wezterm', 'kitty'],
    )
    expect(await installedTerminalApps({ platform: 'linux', wsl: true, home: '/h', exists, which })).toEqual(
      [],
    )
  })
})
