import { mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ApprovalEntry, Profile } from '@remote-harness/protocol'
import { afterEach, describe, expect, test } from 'vitest'
import { silentLogger } from '../src/core/logger.ts'
import { paths } from '../src/core/paths.ts'
import { FileTokenStore } from '../src/core/secrets.ts'
import { BACKUP_SUFFIX } from '../src/features/hooks/installer.ts'
import { PROFILE_HEADER } from '../src/features/hooks/receiver.ts'
import {
  APPROVAL_RETENTION_MS,
  ApprovalLog,
  approvalEntry,
  parseApprovalLines,
  withinRetention,
} from '../src/features/permissions/approval-log.ts'
import { listRuleFiles, markRules, ruleSources } from '../src/features/permissions/rule-listing.ts'
import type { RuleLogEntry } from '../src/features/permissions/rules-log.ts'
import {
  allowRulesOf,
  removeAllowRule,
  withoutAllowRule,
} from '../src/features/permissions/settings-rules.ts'
import { type RunningDaemon, startDaemon } from '../src/main.ts'
import { SECRET_HEADER } from '../src/transport/hooks-server.ts'
import { fakeExecutor, useTempHome, writeTestConfig } from './helpers.ts'
import { authedClient } from './noise-client.ts'

const home = useTempHome()

describe('settings rules', () => {
  test('withoutAllowRule keeps every other key and is null when the rule is absent', () => {
    const settings = { env: { A: '1' }, permissions: { allow: ['Read', 'Bash(ls:*)'], deny: ['X'] } }
    expect(withoutAllowRule(settings, 'Bash(ls:*)')).toEqual({
      env: { A: '1' },
      permissions: { allow: ['Read'], deny: ['X'] },
    })
    expect(withoutAllowRule(settings, 'Edit')).toBeNull()
    expect(withoutAllowRule({}, 'Edit')).toBeNull()
    expect(allowRulesOf({ permissions: { allow: ['Read', 3, null] } })).toEqual(['Read'])
    expect(allowRulesOf('nope')).toEqual([])
  })

  test('removeAllowRule backs the file up, writes it atomically and is idempotent', async () => {
    const file = join(home.dir(), 'settings.json')
    const before = { model: 'x', permissions: { allow: ['Read', 'Bash(ls:*)'] } }
    await writeFile(file, JSON.stringify(before), { mode: 0o600 })
    expect(await removeAllowRule(file, 'Bash(ls:*)')).toBe(true)
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ model: 'x', permissions: { allow: ['Read'] } })
    expect(JSON.parse(await readFile(`${file}${BACKUP_SUFFIX}`, 'utf8'))).toEqual(before)
    expect((await stat(file)).mode & 0o777).toBe(0o600)
    // Already gone: nothing is written, the backup stays the one from before.
    expect(await removeAllowRule(file, 'Bash(ls:*)')).toBe(false)
    expect(JSON.parse(await readFile(`${file}${BACKUP_SUFFIX}`, 'utf8'))).toEqual(before)
    expect(await removeAllowRule(join(home.dir(), 'missing.json'), 'Read')).toBe(false)
  })

  test('removeAllowRule writes through a symlink', async () => {
    const real = join(home.dir(), 'dotfiles', 'settings.json')
    await mkdir(join(home.dir(), 'dotfiles'))
    await writeFile(real, JSON.stringify({ permissions: { allow: ['Read'] } }))
    const link = join(home.dir(), 'settings.json')
    await symlink(real, link)
    expect(await removeAllowRule(link, 'Read')).toBe(true)
    expect(JSON.parse(await readFile(real, 'utf8'))).toEqual({ permissions: { allow: [] } })
  })
})

describe('rule listing', () => {
  const profiles: Profile[] = [
    { id: 'claudin', name: 'C', configDir: '/cfg', color: '' },
    { id: 'codex', name: 'X', configDir: '/codex', color: '', agent: 'codex' },
  ]

  test('profile files of agents with rules, one project file per checkout', () => {
    expect(ruleSources(profiles, ['/w', '/w/.claude/worktrees/login', '', '/other'])).toEqual([
      { file: '/cfg/settings.json', scope: 'profile', profileId: 'claudin', project: null },
      { file: '/w/.claude/settings.local.json', scope: 'project', profileId: null, project: '/w' },
      { file: '/other/.claude/settings.local.json', scope: 'project', profileId: null, project: '/other' },
    ])
  })

  test('marks app-created rules by file and text, latest log entry first', () => {
    const entry = (id: string, rule: string, file: string): RuleLogEntry => ({
      id,
      rule,
      file,
      scope: 'project',
      sessionId: 's',
      createdAt: `2026-10-0${id}T00:00:00.000Z`,
    })
    const log = [entry('1', 'Bash(ls:*)', '/f'), entry('2', 'Bash(ls:*)', '/f'), entry('3', 'Edit', '/g')]
    expect(markRules('/f', ['Bash(ls:*)', 'Edit'], log)).toEqual([
      { origin: 'app', rule: 'Bash(ls:*)', ruleId: '2', createdAt: '2026-10-02T00:00:00.000Z' },
      { origin: 'hand', rule: 'Edit' },
    ])
  })

  test('leaves out missing files and files without rules', async () => {
    const withRules = join(home.dir(), 'a.json')
    const empty = join(home.dir(), 'b.json')
    await writeFile(withRules, JSON.stringify({ permissions: { allow: ['Read'] } }))
    await writeFile(empty, JSON.stringify({ permissions: { allow: [] } }))
    const source = (file: string) => ({ file, scope: 'profile' as const, profileId: 'p', project: null })
    const files = await listRuleFiles([source(withRules), source(empty), source(join(home.dir(), 'c'))], [])
    expect(files).toEqual([{ ...source(withRules), rules: [{ origin: 'hand', rule: 'Read' }] }])
  })
})

describe('approval log', () => {
  const at = new Date('2026-10-25T10:00:00.000Z')

  test('keeps only the sanitized target and the folder name, never the input', () => {
    const entry = approvalEntry(
      {
        action: 'allow',
        device: { id: 'dev1', name: 'Pixel 9' },
        sessionId: 's',
        cwd: '/home/u/code/app',
        tool: 'Bash',
        input: { command: 'git commit -m "secret plan" && git push', description: 'commit it' },
      },
      at,
      'e1',
    )
    expect(entry).toEqual({
      id: 'e1',
      at: at.toISOString(),
      action: 'allow',
      device: { id: 'dev1', name: 'Pixel 9' },
      sessionId: 's',
      folder: 'app',
      tool: 'Bash',
      target: 'git commit',
      rule: null,
      ruleId: null,
    })
    expect(JSON.stringify(entry)).not.toContain('secret')
    const edit = approvalEntry(
      {
        action: 'deny',
        device: null,
        sessionId: 's',
        cwd: '/w',
        tool: 'Edit',
        input: { file_path: '/w/src/a.ts', new_string: 'x' },
      },
      at,
    )
    expect(edit).toMatchObject({ tool: 'Edit', target: 'a.ts' })
    expect(JSON.stringify(edit)).not.toContain('/w/src')
  })

  test('rule actions take the tool from the rule', () => {
    expect(
      approvalEntry(
        { action: 'delete', device: null, sessionId: null, cwd: null, tool: null, rule: 'Bash(ls:*)' },
        at,
      ),
    ).toMatchObject({ action: 'delete', tool: 'Bash', target: null, rule: 'Bash(ls:*)', folder: null })
  })

  test('drops entries older than 30 days', () => {
    const now = at.getTime()
    const make = (ms: number): ApprovalEntry =>
      approvalEntry({ action: 'deny', device: null, sessionId: null, cwd: null, tool: 'Read' }, new Date(ms))
    const fresh = make(now - APPROVAL_RETENTION_MS + 1000)
    expect(withinRetention([make(now - APPROVAL_RETENTION_MS - 1000), fresh], now)).toEqual([fresh])
  })

  test('skips broken lines', () => {
    const good = approvalEntry({ action: 'deny', device: null, sessionId: null, cwd: null, tool: 'Read' }, at)
    expect(parseApprovalLines(`${JSON.stringify(good)}\nnot json\n{"id":1}\n\n`)).toEqual([good])
  })

  test('lists most recent first and prunes the file', async () => {
    let now = at.getTime()
    const log = new ApprovalLog(paths.approvalLog(), () => now)
    const old = await log.add({ action: 'allow', device: null, sessionId: 's', cwd: null, tool: 'Read' })
    now += APPROVAL_RETENTION_MS - 1000
    const recent = await log.add({ action: 'deny', device: null, sessionId: 's', cwd: null, tool: 'Edit' })
    expect((await log.list()).map((e) => e.id)).toEqual([recent.id, old.id])
    now += 2000
    expect((await log.list()).map((e) => e.id)).toEqual([recent.id])
    expect(await log.prune()).toBe(1)
    expect(await log.prune()).toBe(0)
    expect(parseApprovalLines(await readFile(paths.approvalLog(), 'utf8'))).toEqual([recent])
  })
})

describe('integration: rules and approvals over the protocol', () => {
  let daemon: RunningDaemon | undefined
  afterEach(async () => {
    await daemon?.stop()
  })

  test('an allow always is logged with the device; rules are listed, undone and deleted', async () => {
    const [profile] = await writeTestConfig(home.dir())
    if (!profile) throw new Error('no profile')
    const settings = join(profile.configDir, 'settings.json')
    await writeFile(settings, JSON.stringify({ permissions: { allow: ['Read'] } }))
    daemon = await startDaemon({
      logger: silentLogger,
      exec: fakeExecutor(),
      secretStore: new FileTokenStore(),
      dev: true,
      wsPort: 0,
      hookPort: 0,
    })
    const client = await authedClient(daemon)
    const secret = (await readFile(paths.hookSecret(), 'utf8')).trim()
    const hookResponse = fetch(`http://127.0.0.1:${daemon.hookPort}/hooks/PermissionRequest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SECRET_HEADER]: secret, [PROFILE_HEADER]: profile.id },
      body: JSON.stringify({
        session_id: 's',
        cwd: join(home.dir(), 'app'),
        tool_name: 'Bash',
        tool_input: { command: 'pnpm test --filter secret' },
      }),
    })
    const request = await client.until('permission.request')
    client.send({
      type: 'permission.respond',
      id: '1',
      requestId: request.request.requestId,
      decision: 'allow',
      always: { rule: 'Bash(pnpm test:*)', scope: 'profile' },
    })
    await hookResponse
    // Claude Code writes the rule itself after the answer.
    await writeFile(settings, JSON.stringify({ permissions: { allow: ['Read', 'Bash(pnpm test:*)'] } }))

    const approvals = async (id: string) => {
      client.send({ type: 'approvals.list', id })
      return (await client.until('approvals.result')).entries
    }
    let entries: ApprovalEntry[] = []
    for (let i = 0; i < 50 && entries.length === 0; i++) entries = await approvals(`a${i}`)
    expect(entries).toMatchObject([
      {
        action: 'allow',
        always: true,
        folder: 'app',
        tool: 'Bash',
        target: 'pnpm test',
        rule: 'Bash(pnpm test:*)',
      },
    ])
    expect(entries[0]?.device?.id).toBeTruthy()
    expect(JSON.stringify(entries)).not.toContain('secret')

    client.send({ type: 'rules.list', id: 'r1' })
    const listed = await client.until('rules.result')
    expect(listed.files).toMatchObject([
      {
        file: settings,
        scope: 'profile',
        profileId: profile.id,
        rules: [
          { origin: 'hand', rule: 'Read' },
          { origin: 'app', rule: 'Bash(pnpm test:*)', ruleId: entries[0]?.ruleId },
        ],
      },
    ])

    client.send({ type: 'rules.delete', id: 'd1', file: '/etc/hosts', rule: 'Read' })
    expect(await client.until('error')).toMatchObject({ replyTo: 'd1', code: 'not_found' })

    client.send({ type: 'rules.undo', id: 'u1', ruleId: entries[0]?.ruleId ?? '' })
    expect(await client.until('ack')).toMatchObject({ replyTo: 'u1' })
    client.send({ type: 'rules.delete', id: 'd2', file: settings, rule: 'Read' })
    expect(await client.until('ack')).toMatchObject({ replyTo: 'd2' })
    expect(JSON.parse(await readFile(settings, 'utf8'))).toEqual({ permissions: { allow: [] } })
    expect((await approvals('a-last')).map((e) => e.action)).toEqual(['delete', 'undo', 'allow'])
    client.close()
  })
})
