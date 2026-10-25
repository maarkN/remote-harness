import { expect, test } from 'vitest'
import { pairingAddress } from '../src/core/pairing.ts'
import { stopService, stopServiceCommand } from '../src/features/service/stop.ts'
import { fakeExecutor } from './helpers.ts'

test('stopping the service keeps it installed: bootout on macOS, stop on Linux', async () => {
  expect(stopServiceCommand('darwin', 501)).toEqual({
    command: 'launchctl',
    args: ['bootout', 'gui/501/tech.doctorx.claude-remote'],
  })
  expect(stopServiceCommand('linux', 1000)).toEqual({
    command: 'systemctl',
    args: ['--user', 'stop', 'claude-remote.service'],
  })
  expect(stopServiceCommand('win32', 0)).toBeNull()
  const exec = fakeExecutor(() => ({ exitCode: 1, stderr: 'no such job' }))
  await expect(stopService(exec, 'linux')).rejects.toThrow('no such job')
})

test('the pairing address', () => {
  expect(pairingAddress('100.64.0.2', 7337)).toBe('100.64.0.2:7337')
  expect(pairingAddress('fd7a:115c::1', 7337)).toBe('[fd7a:115c::1]:7337')
})
