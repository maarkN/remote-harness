import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import type { ServerMessage } from '@remote-harness/protocol'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createLogger } from '../src/core/logger.ts'
import type { AvailableUpdate } from '../src/features/updates/checker.ts'
import { UpdateLauncher } from '../src/features/updates/launcher.ts'
import { RemoteUpdates } from '../src/features/updates/remote.ts'
import { advanceRun, readRun, startRun, writeRun } from '../src/features/updates/run.ts'
import { MessageRouter } from '../src/transport/router.ts'
import { fakeConnection, useTempHome } from './helpers.ts'

/** The detached updater: no real process, its exit is driven by the test. */
type FakeChild = EventEmitter & { unref: () => void }
const spawned = vi.hoisted(() => ({ calls: [] as Array<{ file: string; args: readonly string[] }> }))
const children: FakeChild[] = []
vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>()
  return {
    ...original,
    spawn: (file: string, args: readonly string[]) => {
      spawned.calls.push({ file, args })
      const child = Object.assign(new EventEmitter(), { unref: () => undefined })
      children.push(child)
      return child
    },
  }
})

const home = useTempHome()
const logger = createLogger({ level: 'silent' })
const update: AvailableUpdate = { version: '0.13.0', commit: 'abc', downgrade: false }

/** The real launcher and `RemoteUpdates`, wired like the updates feature. */
function setup(o: { installer?: boolean } = {}) {
  const router = new MessageRouter(logger)
  const broadcasts: ServerMessage[] = []
  const runPath = join(home.dir(), 'update-run.json')
  let available: AvailableUpdate | null = update
  const exits: Array<number | null> = []
  const launcher: UpdateLauncher = new UpdateLauncher({
    cliPath: '/opt/remote-harness/dist/cli.js',
    installer: o.installer ?? true,
    available: () => available,
    channel: () => 'main',
    recordedRun: () => remote.running(),
    logFile: join(home.dir(), 'logs', 'update.log'),
    systemdRun: false,
    onExit: (code) => exits.push(code),
  })
  const remote: RemoteUpdates = new RemoteUpdates({
    hub: { broadcast: (message) => broadcasts.push(message) },
    router,
    logger,
    runPath,
    current: '0.12.0',
    blocked: null,
    channel: () => 'main',
    checker: () => ({
      state: { channel: 'main', checkedAt: null, available, notifiedCommit: null },
      checking: false,
    }),
    busy: () => false,
    check: async () => undefined,
    saveChannel: async () => undefined,
    refusal: () => launcher.refusal(),
    launch: (onFailure) => launcher.launch(onFailure),
    onFinished: () => launcher.finished(),
    pollMs: 20,
  })
  remote.register()
  const connection = fakeConnection()
  const send = async (message: Parameters<MessageRouter['dispatch']>[0]) => {
    await router.dispatch(message, connection)
    return connection.sent.at(-1)
  }
  return {
    remote,
    launcher,
    send,
    runPath,
    exits,
    broadcasts,
    setAvailable: (next: AvailableUpdate | null) => {
      available = next
    },
  }
}

beforeEach(() => {
  spawned.calls.length = 0
  children.length = 0
})

describe('starting an update through the real launcher (#389)', () => {
  test('the app start spawns the updater instead of being refused by its own run', async () => {
    const { send, runPath, remote, launcher } = setup()
    const reply = await send({ type: 'daemon.update.start', id: '1', channel: 'main' })
    expect(reply).toMatchObject({ type: 'daemon.update.info', info: { run: { step: 'fetching' } } })
    expect(spawned.calls).toEqual([
      { file: process.execPath, args: ['/opt/remote-harness/dist/cli.js', 'update', '--ref', 'main'] },
    ])
    expect(launcher.updating).toBe(true)
    expect(await readRun(runPath)).toMatchObject({ step: 'fetching', from: '0.12.0' })
    // A second start is refused by the running update, with its own reason.
    expect(await send({ type: 'daemon.update.start', id: '2', channel: 'main' })).toMatchObject({
      type: 'error',
      code: 'bad_request',
      message: 'an update is already running',
    })
    expect(spawned.calls).toHaveLength(1)
    remote.stop()
  })

  test('the tray and automatic updates (begin) start the updater too', async () => {
    const { remote, launcher } = setup()
    expect(await remote.begin()).toEqual({ ok: true })
    expect(spawned.calls).toHaveLength(1)
    expect(launcher.refusal()).toBe('running')
    remote.stop()
  })

  test('an updater that exits without restarting the daemon lets the next update start', async () => {
    const { remote, launcher, runPath, exits } = setup()
    await remote.begin()
    const run = (await readRun(runPath))!
    await writeRun(runPath, advanceRun(run, 'done', new Date(), { to: '0.12.0' }))
    children[0]?.emit('exit', 0)
    expect(exits).toEqual([0])
    await vi.waitFor(() => expect(remote.running()).toBe(false))
    expect(launcher.updating).toBe(false)
    expect(await remote.begin()).toEqual({ ok: true })
    expect(spawned.calls).toHaveLength(2)
    remote.stop()
  })

  test('refusals before a run is recorded keep their reason', async () => {
    expect(await setup({ installer: false }).remote.begin()).toEqual({
      ok: false,
      refused: 'not-installer',
      error: 'cannot update: not-installer',
    })
    const upToDate = setup()
    upToDate.setAvailable(null)
    expect(await upToDate.remote.begin()).toEqual({
      ok: false,
      refused: 'nothing',
      error: 'already up to date',
    })
    expect(await readRun(upToDate.runPath)).toBeNull()
    expect(spawned.calls).toEqual([])
  })

  test('a refusal after the run was recorded names it and puts the record back', async () => {
    const { launcher, setAvailable, runPath } = setup()
    const previous = advanceRun(
      startRun({ channel: 'main', from: '0.11.0', now: new Date() }),
      'done',
      new Date(),
    )
    await writeRun(runPath, previous)
    // The offer goes away between `begin`'s check and the spawn (the record was just written).
    const late = new RemoteUpdates({
      hub: { broadcast: () => undefined },
      router: new MessageRouter(logger),
      logger,
      runPath,
      current: '0.12.0',
      blocked: null,
      channel: () => 'main',
      checker: () => null,
      busy: () => false,
      check: async () => undefined,
      saveChannel: async () => undefined,
      refusal: () => launcher.refusal(),
      launch: (onFailure) => {
        setAvailable(null)
        return launcher.launch(onFailure)
      },
    })
    await late.load()
    expect(await late.begin()).toEqual({ ok: false, refused: 'nothing', error: 'already up to date' })
    expect(await readRun(runPath)).toEqual(previous)
    expect(late.info().run).toEqual(previous)
    expect(spawned.calls).toEqual([])
  })

  test('a refusal after the run was recorded removes a record that did not exist', async () => {
    const { launcher, setAvailable, runPath } = setup()
    const late = new RemoteUpdates({
      hub: { broadcast: () => undefined },
      router: new MessageRouter(logger),
      logger,
      runPath,
      current: '0.12.0',
      blocked: null,
      channel: () => 'main',
      checker: () => null,
      busy: () => false,
      check: async () => undefined,
      saveChannel: async () => undefined,
      refusal: () => launcher.refusal(),
      launch: (onFailure) => {
        setAvailable(null)
        return launcher.launch(onFailure)
      },
    })
    expect(await late.begin()).toMatchObject({ ok: false, refused: 'nothing' })
    expect(await readRun(runPath)).toBeNull()
    expect(late.info().run).toBeNull()
  })
})
