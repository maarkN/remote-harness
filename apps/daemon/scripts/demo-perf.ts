/**
 * Performance scenario of the demo (`pnpm --filter @remote-harness/daemon demo --perf`): a long
 * session, a bursty one and one whose pane never stops printing, all generated from a few fictional
 * templates so the load is the same on every run. Pure: `demo.mts` writes and drives it.
 */
import type { DemoEntry, DemoSession } from './demo-data.ts'

/** About 5,000 entries: long enough that rebuilding the whole conversation shows up in the numbers. */
export const PERF_LONG_ENTRIES = 5_000
/** Entries appended to the bursty session's transcript on each burst. */
export const PERF_BURST_SIZE = 25
/** Time between two bursts. */
export const PERF_BURST_MS = 3_000

export const PERF_LONG_ID = '9a4e1c77-3b2d-4f86-a0c5-1d2e3f4a5b61'
export const PERF_BURST_ID = '7c3b2a19-8e4f-4d70-b6a1-2e3f4a5b6c72'
export const PERF_TERMINAL_ID = '5e2d1b08-6f3a-4c91-92b7-3f4a5b6c7d83'

const MODULES = ['billing', 'checkout', 'search', 'profile', 'orders', 'catalog', 'auth', 'cart']

function moduleName(i: number): string {
  return MODULES[i % MODULES.length] ?? 'core'
}

/** A fictional source file of `lines` lines, as a Read result shows it. */
function sourceListing(name: string, lines: number): string {
  return Array.from(
    { length: lines },
    (_, i) =>
      `${String(i + 1).padStart(4)}\t${i % 6 === 0 ? `export function ${name}Step${i}() {` : `  return compute${i}(input, options)`}`,
  ).join('\n')
}

/** Ten entries of one fictional turn: prompt, reasoning, markdown, Read, Edit, Bash, Grep. */
function turn(t: number): DemoEntry[] {
  const name = moduleName(t)
  const file = `src/${name}/handler-${t}.ts`
  return [
    {
      kind: 'user',
      text: `Turn ${t}: the ${name} handler is slow when the cart has many items. Make it faster and keep the tests green.`,
    },
    {
      kind: 'thinking',
      text: `The ${name} handler recomputes totals for every item on each request. Caching per request should remove most of the work; I will read the handler first.`,
    },
    {
      kind: 'text',
      text: `Plan for **${name}**:\n\n1. Read \`${file}\`\n2. Cache the totals per request\n3. Run the tests\n\n\`\`\`ts\nconst totals = new Map<string, number>()\nfor (const item of cart.items) totals.set(item.id, price(item))\n\`\`\``,
    },
    { kind: 'tool', name: 'Read', input: { file_path: file }, result: sourceListing(name, 30) },
    { kind: 'text', text: `The loop at line 12 calls \`price()\` twice per item. I'll cache it.` },
    {
      kind: 'tool',
      name: 'Edit',
      input: {
        file_path: file,
        old_string: `for (const item of cart.items) {\n  total += price(item)\n  tax += price(item) * rate\n}`,
        new_string: `for (const item of cart.items) {\n  const value = price(item)\n  total += value\n  tax += value * rate\n}`,
      },
      result: `The file ${file} has been updated.`,
    },
    {
      kind: 'tool',
      name: 'Bash',
      input: { command: `pnpm test -- ${name}`, description: `Run the ${name} tests` },
      result: Array.from({ length: 20 }, (_, i) => ` ✓ ${name} case ${i + 1} (${(i * 7) % 40} ms)`).join(
        '\n',
      ),
    },
    { kind: 'text', text: `All 20 ${name} tests pass. The handler now prices each item once.` },
    {
      kind: 'tool',
      name: 'Grep',
      input: { pattern: 'price\\(item\\)', path: 'src' },
      result: `src/${name}/handler-${t}.ts:14:  const value = price(item)`,
    },
    { kind: 'text', text: `Done with turn ${t}: one call to \`price()\` per item left in **${name}**.` },
  ]
}

/** The first `count` entries of the long session, deterministic. */
export function longEntries(count = PERF_LONG_ENTRIES): DemoEntry[] {
  const entries: DemoEntry[] = []
  for (let t = 0; entries.length < count; t++) entries.push(...turn(t))
  return entries.slice(0, count)
}

/** The `n`-th burst of the bursty session: a tool-heavy run of `size` entries. */
export function burstEntries(n: number, size = PERF_BURST_SIZE): DemoEntry[] {
  return Array.from({ length: size }, (_, i): DemoEntry => {
    const name = moduleName(n + i)
    const file = `src/${name}/step-${n}-${i}.ts`
    switch (i % 4) {
      case 0:
        return { kind: 'tool', name: 'Read', input: { file_path: file }, result: sourceListing(name, 12) }
      case 1:
        return {
          kind: 'tool',
          name: 'Edit',
          input: { file_path: file, old_string: `step(${i})`, new_string: `step(${i}, { cached: true })` },
          result: `The file ${file} has been updated.`,
        }
      case 2:
        return {
          kind: 'tool',
          name: 'Bash',
          input: { command: `pnpm lint ${file}`, description: 'Lint the changed file' },
          result: `Checked 1 file in ${(n + i) % 30} ms. No fixes applied.`,
        }
      default:
        return { kind: 'text', text: `Burst ${n}, step ${i}: \`${file}\` is cached and linted.` }
    }
  })
}

/**
 * The shell command of the terminal session's pane: a fictional build log, five lines per second,
 * forever (the demo's tmux server is killed on exit).
 */
export function perfPaneCommand(): string {
  return [
    "printf '\\033[2J\\033[H'",
    'i=0',
    'while :; do i=$((i+1))',
    'printf \'\\033[32m✓\\033[0m compiled \\033[1mpackages/module-%04d\\033[0m in %dms\\n\' "$i" $((i % 97 + 3))',
    'sleep 0.2',
    'done',
  ].join('; ')
}

/** The three sessions `--perf` adds to the demo. */
export function perfSessions(): DemoSession[] {
  return [
    {
      id: PERF_LONG_ID,
      profileId: 'personal',
      repo: 'acme-api',
      branch: 'main',
      title: 'Perf: long conversation',
      state: 'idle',
      minutesAgo: 30,
      permissionMode: 'acceptEdits',
      entries: longEntries(),
    },
    {
      id: PERF_BURST_ID,
      profileId: 'work',
      repo: 'acme-web',
      branch: 'main',
      title: 'Perf: bursty session',
      state: 'running',
      minutesAgo: 0,
      permissionMode: 'acceptEdits',
      entries: [
        { kind: 'user', text: 'Cache and lint every step of the checkout flow.' },
        ...burstEntries(0),
      ],
    },
    {
      id: PERF_TERMINAL_ID,
      profileId: 'personal',
      repo: 'infra',
      branch: 'main',
      title: 'Perf: busy terminal',
      state: 'running',
      minutesAgo: 0,
      permissionMode: 'default',
      entries: [{ kind: 'user', text: 'Build every package and keep the log open.' }],
    },
  ]
}
