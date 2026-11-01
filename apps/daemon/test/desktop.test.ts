import { describe, expect, test } from 'vitest'
import { createDesktop } from '../src/infra/desktop.ts'
import { fakeExecutor } from './helpers.ts'

describe('WSL desktop', () => {
  test('opens paths and URLs in Windows, terminals in Windows Terminal, notifications through the sink', async () => {
    const exec = fakeExecutor((call) =>
      call.file === 'wslpath' ? { stdout: '\\\\wsl.localhost\\Ubuntu\\home\\me\\logs\n' } : undefined,
    )
    const notes: [string, string][] = []
    const desktop = createDesktop(exec, 'linux', {
      wsl: true,
      distro: 'Ubuntu',
      notify: (title, body) => notes.push([title, body]),
    })
    await desktop.open('/home/me/logs')
    await desktop.open('https://remoteharness.app/docs')
    await desktop.runInTerminal("'/home/me/bin/remote-harness' doctor")
    await desktop.notify('Remote Harness 0.12.0 available', 'Update from the tray')
    expect(exec.calls.map((call) => [call.file, ...call.args])).toEqual([
      ['wslpath', '-w', '/home/me/logs'],
      ['explorer.exe', '\\\\wsl.localhost\\Ubuntu\\home\\me\\logs'],
      ['explorer.exe', 'https://remoteharness.app/docs'],
      [
        'wt.exe',
        'wsl.exe',
        '-d',
        'Ubuntu',
        'sh',
        '-c',
        `'/home/me/bin/remote-harness' doctor; exec "$SHELL"`,
      ],
    ])
    expect(notes).toEqual([['Remote Harness 0.12.0 available', 'Update from the tray']])
  })

  test('without interop nothing opens, and an odd distribution name falls back to the default one', async () => {
    const exec = fakeExecutor((call) => (call.file === 'wslpath' ? { exitCode: 1 } : undefined))
    const desktop = createDesktop(exec, 'linux', { wsl: true, distro: 'bad name; rm' })
    await desktop.open('/home/me/logs')
    await desktop.runInTerminal('true')
    await desktop.notify('x', 'y')
    expect(exec.calls.map((call) => call.file)).toEqual(['wslpath', 'wt.exe'])
    expect(exec.calls[1]?.args).toEqual(['wsl.exe', 'sh', '-c', 'true; exec "$SHELL"'])
  })
})
