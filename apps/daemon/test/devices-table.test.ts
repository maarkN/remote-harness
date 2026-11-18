import type { PairedDeviceInfo } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { messagesFor } from '../src/core/i18n/index.ts'
import { displayWidth } from '../src/core/text-table.ts'
import { devicesTable } from '../src/features/pairing/devices-table.ts'

const device = (over: Partial<PairedDeviceInfo>): PairedDeviceInfo => ({
  id: '0000000000000000',
  name: 'iPhone',
  platform: 'ios',
  pairedAt: '2026-10-31T01:16:00.000Z',
  lastSeen: null,
  current: false,
  ...over,
})

const devices = [
  device({ id: 'abd769986a7a3ba9', name: 'iPad', lastSeen: '2026-11-02T19:27:10.000Z' }),
  device({
    id: '9f9afad7bcdacb06',
    pairedAt: '2026-10-31T03:10:00.000Z',
    lastSeen: '2026-11-02T03:01:00.000Z',
    app: { version: '1.1.1' },
  }),
  device({ id: '1111111111111111', name: '', platform: '', pairedAt: '2026-11-01T08:00:00.000Z' }),
  device({ id: '2222222222222222', name: 'Velho', pairedAt: '2026-10-01T08:00:00.000Z' }),
  device({
    id: 'fef9980e002f07d1',
    name: 'iPhone da Hanna 📱 com um nome bem comprido',
    pairedAt: '2026-11-16T21:07:00.000Z',
    lastSeen: '2026-11-18T03:18:00.000Z',
    app: { version: '1.2.3', runtime: '1.2.0' },
  }),
]

describe('devices list table', () => {
  test('header, most recently seen first, never seen last by pairing, and "—" for what is unknown', () => {
    const lines = devicesTable(devices, messagesFor('en-US').cli.devices)
    expect(lines[0]).toMatch(/^ID {16}Name {2,}Platform {2}Paired {12}Last seen {9}App$/)
    expect(lines.slice(1).map((line) => line.slice(0, 16))).toEqual([
      'fef9980e002f07d1',
      'abd769986a7a3ba9',
      '9f9afad7bcdacb06',
      '1111111111111111',
      '2222222222222222',
    ])
    expect(lines[1]).toMatch(/2026-11-16 21:07 {2}2026-11-18 03:18 {2}1\.2\.3$/)
    expect(lines[2]).toMatch(/ ios {7}2026-10-31 01:16 {2}2026-11-02 19:27 {2}—$/)
    // No name, no platform, never seen.
    expect(lines[4]).toMatch(/^1111111111111111 {2}— {2,}— {9}2026-11-01 08:00 {2}never {13}—$/)
  })

  test('every column starts at the same terminal column, even after an emoji name', () => {
    const lines = devicesTable(devices, messagesFor('en-US').cli.devices)
    // The paired time starts at the same display column on every row.
    const starts = lines.slice(1).map((line) => displayWidth(line.slice(0, line.indexOf('2026-'))))
    expect(new Set(starts).size).toBe(1)
    const header = lines[0] ?? ''
    expect(displayWidth(header.slice(0, header.indexOf('Paired')))).toBe(starts[0])
  })

  test('headers and "never" in the CLI language', () => {
    expect(devicesTable(devices, messagesFor('pt-BR').cli.devices)[0]).toMatch(
      /^ID +Nome +Plataforma +Pareado em +Visto por último +App$/,
    )
    expect(devicesTable(devices, messagesFor('pt-BR').cli.devices)[4]).toContain('nunca')
    expect(devicesTable(devices, messagesFor('es-ES').cli.devices)[0]).toMatch(
      /^ID +Nombre +Plataforma +Emparejado +Visto por última vez +App$/,
    )
  })
})
