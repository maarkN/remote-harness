import { execFile, execFileSync } from 'node:child_process'
import { lstat, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Profile } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { EventBus } from '../src/core/event-bus.ts'
import type { DaemonEvents } from '../src/core/events.ts'
import { silentLogger } from '../src/core/logger.ts'
import { renderCurlConfig } from '../src/features/hooks/hook-secret.ts'
import {
  BACKUP_SUFFIX,
  existingRcFiles,
  installHooks,
  installLaunchers,
  installShellPath,
  shellRcFiles,
  uninstallHooks,
  uninstallShellPath,
} from '../src/features/hooks/installer.ts'
import {
  isDefaultConfigDir,
  removePathBlock,
  renderLauncher,
  upsertPathBlock,
} from '../src/features/hooks/launcher.ts'
import { HOOK_EVENTS, type HookEvent } from '../src/features/hooks/payloads.ts'
import { HookReceiver, resolveProfileId } from '../src/features/hooks/receiver.ts'
import {
  buildHookEntry,
  isOurHook,
  mergeOurHooks,
  removeOurHooks,
} from '../src/features/hooks/settings-hooks.ts'
import { createHooksServer } from '../src/transport/hooks-server.ts'
import { useTempHome } from './helpers.ts'

const home = useTempHome()
const options = {
  port: 7338,
  curlConfig: '/u/.remote-harness/hook-secret.curlrc',
  permissionTimeoutSec: 300,
}
const userStop = { hooks: [{ type: 'command', command: 'say done' }] }

describe('settings hooks merge', () => {
  test('adds our hooks next to user hooks and is idempotent', () => {
    const settings = { model: 'opus', hooks: { Stop: [userStop] } }
    const once = mergeOurHooks(settings, options)
    const twice = mergeOurHooks(once, options)
    expect(twice).toEqual(once)
    expect(once.model).toBe('opus')
    expect(once.hooks.Stop).toHaveLength(2)
    expect(once.hooks.Stop?.[0]).toEqual(userStop)
    // Every hook is a command (#453): the permission one prints the daemon's answer, the others
    // discard it, and all of them exit 0, so a stopped daemon shows no error in the session.
    const permission = once.hooks.PermissionRequest?.[0]?.hooks[0]
    expect(permission).toMatchObject({ type: 'command', timeout: 310 })
    expect(permission?.command).toContain('curl -s -m 300 -X POST')
    expect(permission?.command).toContain(
      "'http://127.0.0.1:7338/hooks/PermissionRequest' 2>/dev/null || true",
    )
    expect(permission?.command).not.toContain('-o /dev/null')
    for (const event of [
      'SessionStart',
      'SessionEnd',
      'UserPromptSubmit',
      'Stop',
      'SubagentStop',
      'Notification',
    ]) {
      const entry = once.hooks[event]?.at(-1)?.hooks[0]
      expect(entry?.type, event).toBe('command')
      expect(entry?.command, event).toContain(`-o /dev/null -X POST`)
      expect(entry?.command, event).toMatch(
        /'http:\/\/127\.0\.0\.1:7338\/hooks\/\w+' >\/dev\/null 2>&1 \|\| true$/,
      )
      expect(entry?.timeout, event).toBe(event === 'SessionEnd' ? 3 : 10)
    }
    expect(JSON.stringify(once)).not.toContain('"http"')
  })

  test('replaces hooks pointing at an old port', () => {
    const once = mergeOurHooks({}, options)
    const moved = mergeOurHooks(once, { ...options, port: 9000 })
    expect(moved.hooks.Stop).toHaveLength(1)
    expect(moved.hooks.Stop?.[0]?.hooks[0]?.command).toContain("'http://127.0.0.1:9000/hooks/Stop'")
  })

  test('removal restores the user hooks only', () => {
    const settings = { hooks: { Stop: [userStop] } }
    expect(removeOurHooks(mergeOurHooks(settings, options))).toEqual(settings)
    expect(removeOurHooks(mergeOurHooks({ a: 1 }, options))).toEqual({ a: 1 })
  })

  test('the http hooks of an older install are replaced by the command hooks', () => {
    const legacy = {
      hooks: {
        Stop: [userStop, { hooks: [{ type: 'http', url: 'http://127.0.0.1:7338/hooks/Stop', timeout: 5 }] }],
        PermissionRequest: [
          {
            hooks: [
              {
                type: 'http',
                url: 'http://127.0.0.1:7338/hooks/PermissionRequest',
                timeout: 300,
                headers: { 'x-claude-remote-secret': 'old-secret' },
              },
            ],
          },
        ],
      },
    }
    const migrated = mergeOurHooks(legacy, options)
    expect(migrated).toEqual(mergeOurHooks({ hooks: { Stop: [userStop] } }, options))
    expect(JSON.stringify(migrated)).not.toContain('old-secret')
  })

  // Seven shells and curls: given 20 s, since the suites run in parallel on a loaded machine.
  test('every hook stays silent when the daemon is not running', async () => {
    // Nothing listens on the port: curl is refused at once, and the command still exits 0 with no output.
    const down = { ...options, port: 9, permissionTimeoutSec: 2 }
    const run = (event: (typeof HOOK_EVENTS)[number]) =>
      new Promise<{ event: string; code: number; stdout: string }>((resolve) => {
        const child = execFile(
          'sh',
          ['-c', String(buildHookEntry(event, down).command)],
          { env: { PATH: process.env.PATH } },
          (error, stdout) =>
            resolve({ event, code: error ? ((error as { code?: number }).code ?? 1) : 0, stdout }),
        )
        child.stdin?.end(JSON.stringify({ session_id: 'abc', hook_event_name: event }))
      })
    const results = await Promise.all(HOOK_EVENTS.map(run))
    expect(results).toEqual(HOOK_EVENTS.map((event) => ({ event, code: 0, stdout: '' })))
  }, 20_000)
})

describe('installer files', () => {
  async function profile(): Promise<Profile> {
    const configDir = join(home.dir(), 'cfg')
    await mkdir(configDir, { recursive: true })
    return { id: 'claudin', name: 'Pessoal', configDir, color: '#fff' }
  }

  test('writes a backup and keeps other keys', async () => {
    const p = await profile()
    const path = join(p.configDir, 'settings.json')
    await writeFile(path, JSON.stringify({ theme: 'dark', hooks: { Stop: [userStop] } }))
    expect(await installHooks(p, options)).toBe(true)
    expect(await installHooks(p, options)).toBe(false)
    const written = JSON.parse(await readFile(path, 'utf8'))
    expect(written.theme).toBe('dark')
    expect(JSON.parse(await readFile(`${path}${BACKUP_SUFFIX}`, 'utf8')).theme).toBe('dark')
    await uninstallHooks(p)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ theme: 'dark', hooks: { Stop: [userStop] } })
  })

  test('creates settings.json when missing', async () => {
    const p = await profile()
    await installHooks(p, options)
    const written = JSON.parse(await readFile(join(p.configDir, 'settings.json'), 'utf8'))
    expect(Object.keys(written.hooks)).toHaveLength(7)
  })

  test('launchers are executable and valid zsh', async () => {
    const p = await profile()
    const [path] = await installLaunchers([p], {
      binDir: join(home.dir(), 'bin'),
      tmuxSession: 'claude-remote',
      tmuxBin: 'tmux',
    })
    expect(path).toBeDefined()
    expect((await stat(path!)).mode & 0o111).not.toBe(0)
    execFileSync('zsh', ['-n', path!])
    const content = await readFile(path!, 'utf8')
    expect(content.startsWith('#!/usr/bin/env zsh\n')).toBe(true)
    expect(content).toContain(`export CLAUDE_CONFIG_DIR='${p.configDir}'`)
    expect(content).toContain('; select-window')
  })

  test('PATH block is idempotent, backed up and removable', async () => {
    const zshrc = join(home.dir(), '.zshrc')
    await writeFile(zshrc, 'alias ll="ls -la"\n', { mode: 0o640 })
    expect(await installShellPath('/x/bin', [zshrc])).toEqual([zshrc])
    expect(await installShellPath('/x/bin', [zshrc])).toEqual([])
    expect(await readFile(zshrc, 'utf8')).toContain("export PATH='/x/bin'")
    expect(await readFile(`${zshrc}${BACKUP_SUFFIX}`, 'utf8')).toBe('alias ll="ls -la"\n')
    expect((await stat(zshrc)).mode & 0o777).toBe(0o640)
    expect(await uninstallShellPath([zshrc])).toEqual([zshrc])
    expect(await readFile(zshrc, 'utf8')).toBe('alias ll="ls -la"\n')
    expect(await uninstallShellPath([zshrc])).toEqual([])
  })

  test('PATH block goes to every rc file and creates a missing one without a backup', async () => {
    const zshrc = join(home.dir(), '.zshrc')
    const bashrc = join(home.dir(), '.bashrc')
    await writeFile(zshrc, '# zsh\n')
    expect(await installShellPath('/x/bin', [bashrc, zshrc])).toEqual([bashrc, zshrc])
    expect(await readFile(bashrc, 'utf8')).toBe(
      '# >>> claude-remote >>>\nexport PATH=\'/x/bin\':"$PATH"\n# <<< claude-remote <<<\n',
    )
    await expect(stat(`${bashrc}${BACKUP_SUFFIX}`)).rejects.toThrow()
    execFileSync('bash', ['-n', bashrc])
    const out = execFileSync('bash', ['-c', `source '${bashrc}' && echo "$PATH"`]).toString()
    expect(out.startsWith('/x/bin:')).toBe(true)
  })

  test('PATH block follows a symlinked rc file (dotfile managers)', async () => {
    const real = join(home.dir(), 'dotfiles-zshrc')
    const link = join(home.dir(), '.zshrc')
    await writeFile(real, '# mine\n')
    await symlink(real, link)
    await installShellPath('/x/bin', [link])
    expect((await lstat(link)).isSymbolicLink()).toBe(true)
    expect(await readFile(real, 'utf8')).toContain("export PATH='/x/bin'")
  })

  test('PATH helpers handle empty files', () => {
    const added = upsertPathBlock('', '/b')
    expect(removePathBlock(added)).toBe('')
  })

  test('rc files: the one of $SHELL first, then the other ones that exist', () => {
    const h = '/home/me'
    const present =
      (...names: string[]) =>
      (p: string) =>
        names.some((n) => p === join(h, n))
    // Bash user without ~/.zshrc: only ~/.bashrc
    expect(shellRcFiles({ home: h, shell: '/bin/bash', exists: present(), fallback: '.zshrc' })).toEqual([
      join(h, '.bashrc'),
    ])
    expect(
      shellRcFiles({
        home: h,
        shell: '/usr/bin/zsh',
        exists: present('.bashrc', '.zshrc'),
        fallback: '.zshrc',
      }),
    ).toEqual([join(h, '.zshrc'), join(h, '.bashrc')])
    expect(shellRcFiles({ home: h, shell: '/bin/zsh', exists: present(), fallback: '.bashrc' })).toEqual([
      join(h, '.zshrc'),
    ])
    expect(
      shellRcFiles({ home: h, shell: '/usr/bin/fish', exists: present('.bashrc'), fallback: '.zshrc' }),
    ).toEqual([join(h, '.bashrc')])
    expect(shellRcFiles({ home: h, shell: undefined, exists: present(), fallback: '.bashrc' })).toEqual([
      join(h, '.bashrc'),
    ])
    expect(existingRcFiles(h, present('.bashrc'))).toEqual([join(h, '.bashrc')])
  })
})

describe('launcher script quoting', () => {
  test('quotes single quotes in paths', () => {
    const script = renderLauncher(
      { id: 'x', name: 'X', configDir: "/tmp/it's", color: '' },
      { tmuxSession: 's', tmuxBin: 'tmux' },
    )
    expect(script).toContain(`'/tmp/it'\\''s'`)
  })

  test('the default ~/.claude profile runs with CLAUDE_CONFIG_DIR unset', () => {
    const tmux = { tmuxSession: 's', tmuxBin: 'tmux', home: '/Users/u' }
    const script = renderLauncher({ id: 'p', name: 'P', configDir: '/Users/u/.claude/', color: '' }, tmux)
    execFileSync('zsh', ['-n', '-c', script])
    expect(script).toContain('unset CLAUDE_CONFIG_DIR')
    expect(script).toContain('cmd=(env -u CLAUDE_CONFIG_DIR "$CLAUDE_BIN" "$@")')
    expect(script).not.toContain('-e "CLAUDE_CONFIG_DIR')
    expect(isDefaultConfigDir('/Users/u/.claude-work', '/Users/u')).toBe(false)
  })

  test('attaches with xterm-256color when the terminal has no terminfo entry here', async () => {
    // Fake tmux: no session yet, prints ids on new-session and records TERM on attach-session.
    const fake = join(home.dir(), 'tmux')
    const seen = join(home.dir(), 'term')
    await writeFile(
      fake,
      // The detached new-session creates the window; the attached one (the view) records TERM.
      `#!/bin/sh\ncase "$1" in\nhas-session) exit 1 ;;\nnew-session) if [ "$2" = -d ]; then [ "$3" = -P ] && echo '%1 @1'; else printf '%s' "$TERM" > '${seen}'; fi; exit 0 ;;\nesac\n`,
      { mode: 0o755 },
    )
    const script = renderLauncher(
      { id: 'p', name: 'P', configDir: '/Users/u/.claude', color: '' },
      { tmuxSession: 's', tmuxBin: fake, home: '/Users/u' },
    )
    const { TMUX: _, ...env } = process.env
    const attach = async (term: string) => {
      execFileSync('zsh', ['-c', script], { env: { ...env, TERM: term }, cwd: home.dir() })
      return readFile(seen, 'utf8')
    }
    expect(await attach('xterm-not-installed-anywhere')).toBe('xterm-256color')
    expect(await attach('vt100')).toBe('vt100')
  })
})

describe('launcher on the Remote Harness tmux server', () => {
  const server = { socket: 'remote-harness', conf: '/Users/u/.remote-harness/tmux.conf' }
  const options = { tmuxSession: 's', tmuxBin: 'tmux', tmuxServer: server, home: '/Users/u' }
  const profile: Profile = { id: 'p', name: 'P', configDir: '/Users/u/.claude', color: '' }

  test('every tmux call selects the server and its config; null keeps the default server', () => {
    const script = renderLauncher(profile, options)
    execFileSync('zsh', ['-n', '-c', script])
    expect(script).toContain(
      `TMUX_CMD=("$TMUX_BIN" -L 'remote-harness' -f '/Users/u/.remote-harness/tmux.conf')`,
    )
    expect(script).not.toMatch(
      /"\$TMUX_BIN" (has-session|new-window|new-session|attach-session|switch-client)/,
    )
    expect(renderLauncher(profile, { ...options, tmuxServer: null })).toContain('TMUX_CMD=("$TMUX_BIN")')
  })

  /** A fake tmux that logs every call with the caller's TMUX and answers like a server with one window. */
  async function fakeTmux(): Promise<{ bin: string; log: () => Promise<string> }> {
    const bin = join(home.dir(), 'tmux')
    const log = join(home.dir(), 'tmux.log')
    await writeFile(
      bin,
      `#!/bin/sh
printf '%s | TMUX=%s\\n' "$*" "\${TMUX-unset}" >> '${log}'
while [ "$1" = -L ] || [ "$1" = -f ]; do shift 2; done
case "$1" in
  has-session) exit 1 ;;
  new-session) [ "$3" = -P ] && echo '%1 @1'; exit 0 ;;
  display-message) echo /tmp/tmux-501/remote-harness ;;
esac
exit 0
`,
      { mode: 0o755 },
    )
    return { bin, log: () => readFile(log, 'utf8') }
  }

  test("inside another server's tmux: nests in the pane with the status off, never switch-client", async () => {
    const fake = await fakeTmux()
    const script = renderLauncher(profile, { ...options, tmuxBin: fake.bin })
    execFileSync('zsh', ['-c', script], {
      env: { ...process.env, TMUX: '/tmp/tmux-501/default,123,0' },
      cwd: home.dir(),
    })
    const log = await fake.log()
    expect(log).toContain('-L remote-harness -f /Users/u/.remote-harness/tmux.conf has-session -t =s')
    // One client creates the view, attaches to it and turns its status line off, with TMUX unset.
    expect(log).toMatch(
      /new-session -t =s -s s-view-\d+ ; set-option -t s-view-\d+ destroy-unattached on ; select-window -t =s-view-\d+:@1 ; set-option -t s-view-\d+ status off \| TMUX=unset/,
    )
    expect(log).not.toContain('switch-client')
  })

  test('a first prompt reaches the window through its environment, never the command line', async () => {
    const fake = await fakeTmux()
    const script = renderLauncher(profile, { ...options, tmuxBin: fake.bin })
    const { TMUX: _, ...env } = process.env
    const run = (extra: Record<string, string>) =>
      execFileSync('zsh', ['-c', script], {
        env: { ...env, CLAUDE_REMOTE_NO_ATTACH: '1', ...extra },
        cwd: home.dir(),
      })
    run({})
    const before = await fake.log()
    expect(before).not.toContain('CLAUDE_REMOTE_PROMPT')
    const prompt = 'Review the open PR.\nList the "risks" for $USER.'
    run({ CLAUDE_REMOTE_PROMPT: prompt })
    const after = (await fake.log()).slice(before.length)
    // The window gets the text, line break and quotes intact, and its shell expands it: the command
    // line (the last argument, before ` | TMUX=`) ends with the variable, not the text.
    expect(after).toContain(`-e CLAUDE_REMOTE_PROMPT=${prompt} `)
    expect(after).toContain('env -u CLAUDE_CONFIG_DIR claude -- "$CLAUDE_REMOTE_PROMPT" | TMUX=')
    expect(after).not.toContain(`${prompt} | TMUX=`)
    // A Kimi CLI launcher has no such block at all.
    const kimi = renderLauncher({ ...profile, configDir: '/Users/u/.kimi', agent: 'kimi' }, options)
    execFileSync('zsh', ['-n', '-c', kimi])
    expect(kimi).not.toContain('CLAUDE_REMOTE_PROMPT')
  })

  test('inside a client of the Remote Harness server: switches that client', async () => {
    const fake = await fakeTmux()
    const script = renderLauncher(profile, { ...options, tmuxBin: fake.bin })
    execFileSync('zsh', ['-c', script], {
      env: { ...process.env, TMUX: '/tmp/tmux-501/remote-harness,123,0' },
      cwd: home.dir(),
    })
    const log = await fake.log()
    // The view is created detached and the current client switched to it in the same command.
    expect(log).toMatch(
      /new-session -d -t =s -s s-view-\d+ ; .* ; switch-client -t =s-view-\d+ \| TMUX=\/tmp\/tmux-501\/remote-harness,123,0/,
    )
    expect(log).not.toContain('status off')
    expect(log).not.toContain('TMUX=unset')
  })
})

describe('hook receiver', () => {
  const profiles: Profile[] = [
    { id: 'claudin', name: 'P', configDir: '/Users/u/.claude', color: '' },
    { id: 'drclaude', name: 'D', configDir: '/Users/u/.claude-doctorx', color: '' },
  ]

  test('resolves profile from header or transcript path', () => {
    expect(resolveProfileId('drclaude', undefined, profiles)).toBe('drclaude')
    expect(resolveProfileId(null, '/Users/u/.claude-doctorx/projects/x/s.jsonl', profiles)).toBe('drclaude')
    expect(resolveProfileId(null, '/Users/u/.claude/projects/x/s.jsonl', profiles)).toBe('claudin')
    expect(resolveProfileId(null, undefined, profiles)).toBeNull()
  })

  async function setup() {
    const bus = new EventBus<DaemonEvents>()
    const app = createHooksServer({ secret: 'sec', logger: silentLogger })
    const receiver = new HookReceiver(bus, profiles, silentLogger)
    receiver.register(app)
    const events: HookEvent[] = []
    bus.on('hook', (e) => events.push(e))
    return { app, receiver, events }
  }

  test('publishes SessionStart with pane and profile', async () => {
    const { app, events } = await setup()
    const res = await app.inject({
      method: 'POST',
      url: '/hooks/SessionStart',
      headers: {
        'x-claude-remote-secret': 'sec',
        'x-claude-remote-pane': '%12',
        'x-claude-remote-profile': 'claudin',
      },
      payload: { session_id: 'abc', cwd: '/w', source: 'startup', hook_event_name: 'SessionStart' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({})
    expect(events[0]).toMatchObject({ event: 'SessionStart', paneId: '%12', profileId: 'claudin' })
    expect(events[0]?.payload.source).toBe('startup')
  })

  test('the SessionStart command hook posts stdin with pane and profile and prints nothing', async () => {
    const { app, events } = await setup()
    await app.listen({ host: '127.0.0.1', port: 0 })
    try {
      const address = app.server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      // curl reads the secret header from the 0600 config, so the command carries only its path.
      const curlConfig = join(home.dir(), 'hook-secret.curlrc')
      await writeFile(curlConfig, renderCurlConfig('sec'), { mode: 0o600 })
      const entry = buildHookEntry('SessionStart', { port, curlConfig, permissionTimeoutSec: 300 })
      expect(entry.type).toBe('command')
      expect(isOurHook(entry)).toBe(true)
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = execFile(
          'sh',
          ['-c', String(entry.command)],
          { env: { PATH: process.env.PATH, TMUX_PANE: '%7', CLAUDE_REMOTE_PROFILE: 'claudin' } },
          (error, out) => (error ? reject(error) : resolve(out)),
        )
        child.stdin?.end(JSON.stringify({ session_id: 'abc', cwd: '/w', source: 'resume' }))
      })
      expect(stdout).toBe('')
      expect(events[0]).toMatchObject({ event: 'SessionStart', paneId: '%7', profileId: 'claudin' })
      expect(events[0]?.payload.source).toBe('resume')
    } finally {
      await app.close()
    }
  })

  test('treats empty or unexpanded env headers as missing', async () => {
    const { app, events } = await setup()
    await app.inject({
      method: 'POST',
      url: '/hooks/Stop',
      headers: {
        'x-claude-remote-secret': 'sec',
        'x-claude-remote-pane': '$TMUX_PANE',
        'x-claude-remote-profile': '',
      },
      payload: { session_id: 'abc' },
    })
    expect(events[0]).toMatchObject({ paneId: null, profileId: null })
  })

  test('rejects unknown events, bad payloads and missing secret', async () => {
    const { app } = await setup()
    const headers = { 'x-claude-remote-secret': 'sec' }
    expect((await app.inject({ method: 'POST', url: '/hooks/Nope', headers, payload: {} })).statusCode).toBe(
      404,
    )
    expect((await app.inject({ method: 'POST', url: '/hooks/Stop', headers, payload: {} })).statusCode).toBe(
      400,
    )
    expect(
      (await app.inject({ method: 'POST', url: '/hooks/Stop', payload: { session_id: 'a' } })).statusCode,
    ).toBe(401)
  })

  test('uses the responder for decision hooks', async () => {
    const { app, receiver } = await setup()
    receiver.setResponder('PermissionRequest', async () => ({ decided: true }))
    const res = await app.inject({
      method: 'POST',
      url: '/hooks/PermissionRequest',
      headers: { 'x-claude-remote-secret': 'sec' },
      payload: { session_id: 'abc', tool_name: 'Bash' },
    })
    expect(res.json()).toEqual({ decided: true })
  })
})
