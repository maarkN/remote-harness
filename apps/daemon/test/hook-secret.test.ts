import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { describe, expect, test } from 'vitest'
import { paths } from '../src/core/paths.ts'
import {
  ensureHookSecretFiles,
  hookCurlConfigMatches,
  renderCurlConfig,
} from '../src/features/hooks/hook-secret.ts'
import { mergeKimiHooks, tomlString } from '../src/features/hooks/kimi-hooks.ts'
import { type HookStyle, mergeOurHooks } from '../src/features/hooks/settings-hooks.ts'
import { renderStatusLineScript } from '../src/features/status-line/wrapper.ts'
import { SECRET_HEADER } from '../src/transport/hooks-server.ts'
import { useTempHome } from './helpers.ts'

useTempHome()

describe('hook secret files', () => {
  test('the curl config is one header line, quoted for curl', () => {
    expect(renderCurlConfig('abc')).toMatch(
      /^# Remote Harness: [^\n]+\nheader = "x-claude-remote-secret: abc"\n$/,
    )
    expect(renderCurlConfig('a"b\\c')).toContain('header = "x-claude-remote-secret: a\\"b\\\\c"')
  })

  test('a fresh install creates both files with mode 0600', async () => {
    const files = await ensureHookSecretFiles()
    expect(files).toMatchObject({ curlConfig: paths.hookCurlConfig(), rotated: false })
    expect((await readFile(paths.hookSecret(), 'utf8')).trim()).toBe(files.secret)
    expect(await readFile(files.curlConfig, 'utf8')).toBe(renderCurlConfig(files.secret))
    expect((await stat(paths.hookSecret())).mode & 0o777).toBe(0o600)
    expect((await stat(files.curlConfig)).mode & 0o777).toBe(0o600)
    expect(await hookCurlConfigMatches()).toBe(true)
  })

  test('a secret without a curl config came from a version that exposed it: rotated once', async () => {
    await mkdir(dirname(paths.hookSecret()), { recursive: true })
    await writeFile(paths.hookSecret(), 'old-secret\n', { mode: 0o600 })
    const first = await ensureHookSecretFiles()
    expect(first.rotated).toBe(true)
    expect(first.secret).not.toBe('old-secret')
    expect((await readFile(paths.hookSecret(), 'utf8')).trim()).toBe(first.secret)
    expect(await readFile(first.curlConfig, 'utf8')).toBe(renderCurlConfig(first.secret))
    expect(await ensureHookSecretFiles()).toEqual({ ...first, rotated: false })
  })

  test('a stale curl config is rewritten from the secret without rotating', async () => {
    const files = await ensureHookSecretFiles()
    await writeFile(files.curlConfig, renderCurlConfig('something-else'))
    expect(await hookCurlConfigMatches()).toBe(false)
    expect(await ensureHookSecretFiles()).toEqual({ ...files, rotated: false })
    expect(await hookCurlConfigMatches()).toBe(true)
  })

  test('doctor sees missing files', async () => {
    expect(await hookCurlConfigMatches()).toBe(false)
    const files = await ensureHookSecretFiles()
    await rm(files.curlConfig)
    expect(await hookCurlConfigMatches()).toBe(false)
  })
})

describe('generated commands carry no secret', () => {
  const secret = 's3cr3t-value-9f8e'
  const curlConfig = "/Users/it's/.remote-harness/hook-secret.curlrc"
  const options = { port: 7338, secret, curlConfig, permissionTimeoutSec: 300 }
  const quoted = `-K '/Users/it'\\''s/.remote-harness/hook-secret.curlrc'`

  test('hooks of every style pass the curl config instead of the header', () => {
    const styles: HookStyle[] = ['claude-settings', 'codex-hooks', 'gemini-hooks', 'qwen-settings']
    for (const style of styles) {
      const entries = Object.values(mergeOurHooks({}, options, style).hooks).flatMap((groups) =>
        groups.flatMap((group) => group.hooks),
      )
      expect(entries.length).toBeGreaterThan(0)
      for (const entry of entries) {
        if (entry.type === 'command') {
          expect(entry.command).not.toContain(secret)
          expect(entry.command).not.toContain(SECRET_HEADER)
          expect(entry.command).toContain(quoted)
        } else {
          // Claude Code reads these from its own 0600 settings.json; no command line is involved.
          expect(entry.type).toBe('http')
          expect(entry.headers).toMatchObject({ [SECRET_HEADER]: secret })
        }
      }
    }
  })

  test('Kimi tables and the status line script likewise', () => {
    const toml = mergeKimiHooks('', options) ?? ''
    expect(toml).not.toContain(secret)
    const line = toml.split('\n').find((l) => l.startsWith('command = ')) ?? ''
    expect(tomlString(line.slice('command = '.length))).toContain(quoted)
    const script = renderStatusLineScript({ port: 7338, curlConfig })
    expect(script).not.toContain(SECRET_HEADER)
    expect(script).toContain(quoted)
  })
})
