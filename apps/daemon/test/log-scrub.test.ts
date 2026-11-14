import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { LOG_TAILS, readComputerLogs, readLogTail, scrubLog } from '../src/features/diagnostics/logs.ts'
import { useTempHome } from './helpers.ts'

const home = useTempHome()
const HOME = '/Users/me'

describe('scrubLog', () => {
  test('redacts the values of sensitive JSON keys and keeps the rest', () => {
    const line = JSON.stringify({
      level: 30,
      msg: 'paired',
      token: 'abc123',
      pairingCode: '482193',
      code: 'invalid_cwd',
      req: { prompt: 'fix the login bug', authorization: 'Basic x', type: 'session.start' },
      sessionId: '6f1c2a0e-1b7d-4c55-9a8e-0d3f5b2c9a11',
    })
    const out = JSON.parse(scrubLog(line, HOME)) as Record<string, unknown>
    expect(out).toEqual({
      level: 30,
      msg: 'paired',
      token: '[redacted]',
      pairingCode: '[redacted]',
      code: 'invalid_cwd',
      req: { prompt: '[redacted]', authorization: '[redacted]', type: 'session.start' },
      sessionId: '6f1c2a0e-1b7d-4c55-9a8e-0d3f5b2c9a11',
    })
  })

  test('replaces emails, tokens, IPs, long runs and the home folder in any line', () => {
    const text = [
      'login as me@example.com from 192.168.2.36',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload',
      'key sk-or-v1-0123456789abcdef in /Users/me/project/.env',
      `secret ${'A'.repeat(40)} end`,
    ].join('\n')
    expect(scrubLog(text, HOME)).toBe(
      [
        'login as [email] from [ip]',
        'Authorization: Bearer [redacted]',
        'key [token] in ~/project/.env',
        'secret [redacted] end',
      ].join('\n'),
    )
  })

  test('a JSON line keeps being JSON and its strings are scrubbed too', () => {
    const line = JSON.stringify({
      msg: 'session started',
      cwd: '/Users/me/app',
      err: { message: 'to a@b.co' },
    })
    expect(JSON.parse(scrubLog(line, HOME))).toEqual({
      msg: 'session started',
      cwd: '~/app',
      err: { message: 'to [email]' },
    })
  })
})

describe('readLogTail', () => {
  test('a large file: only its last bytes, from a whole line, marked truncated', async () => {
    const path = join(home.dir(), 'big.log')
    const lines = Array.from({ length: 5000 }, (_, i) => `line ${i} ${'x'.repeat(40)}`)
    await writeFile(path, `${lines.join('\n')}\n`)
    const tail = await readLogTail(path, 4096)
    expect(tail?.truncated).toBe(true)
    expect(tail?.text.length).toBeLessThanOrEqual(4096)
    expect(tail?.text.startsWith('line ')).toBe(true)
    expect(tail?.text.trimEnd().endsWith(`line 4999 ${'x'.repeat(40)}`)).toBe(true)
  })

  test('a small file whole; a missing one null', async () => {
    const path = join(home.dir(), 'small.log')
    await writeFile(path, 'one\ntwo\n')
    expect(await readLogTail(path, 4096)).toEqual({ text: 'one\ntwo\n', truncated: false })
    expect(await readLogTail(join(home.dir(), 'none.log'), 4096)).toBeNull()
  })
})

describe('readComputerLogs', () => {
  test('the present log files, in order, scrubbed', async () => {
    const dir = join(home.dir(), 'logs')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'daemon.log'), `${JSON.stringify({ msg: 'started', token: 't' })}\n`)
    await writeFile(join(dir, 'update.log'), 'updated by me@example.com\n')
    const files = await readComputerLogs(dir, HOME)
    expect(files.map((f) => f.name)).toEqual(['daemon.log', 'update.log'])
    expect(files[0]?.text).toContain('"token":"[redacted]"')
    expect(files[1]?.text).toBe('updated by [email]\n')
    expect(LOG_TAILS.map((t) => t.name)).toEqual(['daemon.log', 'daemon.err.log', 'update.log'])
  })
})
