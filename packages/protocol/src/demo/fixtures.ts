/**
 * Fictional data shared by the daemon's screenshot demo (`pnpm --filter @remote-harness/daemon demo`)
 * and the app's offline demo: profiles, repositories, sessions with their transcripts, status lines and
 * subagents. Pure (no Node APIs), so both the daemon scripts and the app bundle read it. Every name,
 * path, prompt and output MUST stay fictional.
 */

export const DEMO_HOST_NAME = 'studio'

export type DemoState = 'waiting' | 'running' | 'idle' | 'ended'

export type DemoRepo = { name: string; branches: string[]; worktrees: { name: string; branch: string }[] }

export type DemoEntry =
  | { kind: 'user'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; input: Record<string, unknown>; result?: string; error?: boolean }

/** A subagent of a session, with its own transcript (the in-app demo shows it; the daemon demo does not). */
export type DemoSubagent = {
  agentId: string
  agentType: string
  description: string
  state: 'running' | 'done'
  /** Start, in minutes before the demo starts. */
  minutesAgo: number
  entries: DemoEntry[]
}

export type DemoSession = {
  id: string
  profileId: string
  /** Repository name under `~/code`, plus the worktree name when the session works in one. */
  repo: string
  worktree?: string
  branch: string
  title: string
  state: DemoState
  /** Last activity, in minutes before the demo starts. */
  minutesAgo: number
  permissionMode: 'default' | 'acceptEdits' | 'plan' | 'auto'
  entries: DemoEntry[]
  /**
   * The tool call waiting for an answer (the last `tool` entry, without a result), with what the
   * in-app demo shows once it is allowed: the tool's result and the agent's next message.
   */
  permission?: { toolName: string; input: Record<string, unknown>; result: string; followUp: string }
  status?: DemoStatus
  subagents?: DemoSubagent[]
}

export type DemoStatus = {
  model: { id: string; display_name: string }
  effort: string
  contextUsed: number
  contextSize: number
  fiveHour: number
  sevenDay: number
}

export type DemoProfile = {
  id: string
  name: string
  configDir: string
  color: string
  agent?: 'codex'
  provider?: { kind: 'openrouter'; model: string }
}

export const DEMO_PROFILES: DemoProfile[] = [
  { id: 'personal', name: 'Personal', configDir: '~/.claude', color: '#D97757' },
  { id: 'work', name: 'Work', configDir: '~/.claude-work', color: '#61AFEF' },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    configDir: '~/.claude-openrouter',
    color: '#8A8784',
    provider: { kind: 'openrouter', model: 'anthropic/claude-sonnet-5.5' },
  },
  { id: 'codex', name: 'Codex', configDir: '~/.codex', color: '#2FBF8F', agent: 'codex' },
]

export const DEMO_REPOS: DemoRepo[] = [
  { name: 'acme-api', branches: ['main'], worktrees: [{ name: 'rate-limit', branch: 'feat/rate-limit' }] },
  { name: 'acme-web', branches: ['main', 'feat/dark-mode'], worktrees: [] },
  { name: 'blog', branches: ['main'], worktrees: [] },
  {
    name: 'infra',
    branches: ['main'],
    worktrees: [{ name: 'terraform-1-9', branch: 'chore/terraform-1.9' }],
  },
  { name: 'design-system', branches: ['main'], worktrees: [] },
]

const OPUS = { id: 'claude-opus-5-5', display_name: 'Opus 5.5' }

export const DEMO_SESSIONS: DemoSession[] = [
  {
    id: '6f1c2a0e-1b7d-4c55-9a8e-0d3f5b2c9a11',
    profileId: 'personal',
    repo: 'acme-api',
    worktree: 'rate-limit',
    branch: 'feat/rate-limit',
    title: 'Rate limit the login endpoint',
    state: 'waiting',
    minutesAgo: 0,
    permissionMode: 'default',
    status: {
      model: { id: 'claude-sonnet-5-5', display_name: 'Sonnet 5.5' },
      effort: 'medium',
      contextUsed: 61,
      contextSize: 200_000,
      fiveHour: 23,
      sevenDay: 41,
    },
    entries: [
      {
        kind: 'user',
        text: 'The login endpoint returns 500 under load. Find out why and add rate limiting per IP.',
      },
      {
        kind: 'thinking',
        text: 'A 500 under load usually means the session store runs out of connections. I will check the pool size first, then add a limiter in front of the route.',
      },
      { kind: 'text', text: "I'll start with the route and the database pool." },
      {
        kind: 'tool',
        name: 'Grep',
        input: { pattern: 'createPool', path: 'src' },
        result: 'src/db/pool.ts:4:export const pool = createPool({ max: 5 })',
      },
      {
        kind: 'text',
        text: 'The pool allows only **5** connections, and every login opens two. That is the 500. I added a per-IP limiter and raised the pool to 20.',
      },
      {
        kind: 'tool',
        name: 'Edit',
        input: {
          file_path: 'src/routes/login.ts',
          old_string: "router.post('/login', login)",
          new_string: "router.post('/login', rateLimit({ window: '1m', max: 10, key: ip }), login)",
        },
        result: 'The file src/routes/login.ts has been updated.',
      },
      { kind: 'text', text: 'Now the tests for the login route.' },
      {
        kind: 'tool',
        name: 'Bash',
        input: { command: 'pnpm --filter api test -- login', description: 'Run the login route tests' },
      },
    ],
    permission: {
      toolName: 'Bash',
      input: { command: 'pnpm --filter api test -- login', description: 'Run the login route tests' },
      result:
        ' ✓ test/routes/login.test.ts (9 tests) 212ms\n\n Test Files  1 passed (1)\n      Tests  9 passed (9)',
      followUp:
        'All 9 login tests pass. After 10 attempts a minute from the same IP the route now answers **429**, and the pool no longer runs out.',
    },
  },
  {
    id: '2b9d7e41-5c3a-4f0e-8d21-7a6b4c1e0f22',
    profileId: 'work',
    repo: 'acme-web',
    branch: 'feat/dark-mode',
    title: 'Dark mode toggle in settings',
    state: 'running',
    minutesAgo: 0,
    permissionMode: 'acceptEdits',
    status: {
      model: OPUS,
      effort: 'high',
      contextUsed: 38,
      contextSize: 200_000,
      fiveHour: 23,
      sevenDay: 41,
    },
    entries: [
      {
        kind: 'user',
        text: "Add a dark mode toggle to the settings page. Keep the user's choice across reloads.",
      },
      {
        kind: 'thinking',
        text: 'The settings page lives in src/routes/settings.tsx and the theme tokens in src/theme.ts. I will store the choice in localStorage and read it before the first paint.',
      },
      { kind: 'text', text: "I'll look at how the theme is applied first." },
      {
        kind: 'tool',
        name: 'Grep',
        input: { pattern: 'useTheme', path: 'src' },
        result: 'src/theme.ts\nsrc/routes/settings.tsx\nsrc/main.tsx',
      },
      {
        kind: 'tool',
        name: 'Edit',
        input: {
          file_path: 'src/routes/settings.tsx',
          old_string: '<Section title="Appearance">\n  <FontSize />',
          new_string:
            '<Section title="Appearance">\n  <ThemeToggle value={theme} onChange={setTheme} />\n  <FontSize />',
        },
        result: 'The file src/routes/settings.tsx has been updated.',
      },
      {
        kind: 'tool',
        name: 'Edit',
        input: {
          file_path: 'src/theme.ts',
          old_string: "export const initialTheme = 'light'",
          new_string: "export const initialTheme = localStorage.getItem('theme') ?? 'light'",
        },
        result: 'The file src/theme.ts has been updated.',
      },
      {
        kind: 'tool',
        name: 'Bash',
        input: { command: 'pnpm test settings', description: 'Run the settings tests' },
        result:
          ' ✓ src/routes/settings.test.tsx (6 tests) 41ms\n\n Test Files  1 passed (1)\n      Tests  6 passed (6)',
      },
      {
        kind: 'text',
        text: 'Done. The toggle sits at the top of **Appearance**:\n\n- `settings.tsx` renders `<ThemeToggle>` bound to the current theme.\n- `theme.ts` reads the saved choice before the first paint, so there is no flash.\n\nAll 6 settings tests pass.',
      },
      { kind: 'user', text: 'Also follow the system setting until the user picks one.' },
      {
        kind: 'thinking',
        text: "`matchMedia('(prefers-color-scheme: dark)')` gives the system setting; the saved choice wins once there is one.",
      },
    ],
    subagents: [
      {
        agentId: 'a3f9c2e1d4b5',
        agentType: 'Explore',
        description: 'Find where the theme is read at start-up',
        state: 'done',
        minutesAgo: 3,
        entries: [
          { kind: 'user', text: 'Find every place that reads the theme before the first render.' },
          {
            kind: 'tool',
            name: 'Grep',
            input: { pattern: 'initialTheme', path: 'src' },
            result: 'src/theme.ts\nsrc/main.tsx',
          },
          {
            kind: 'tool',
            name: 'Read',
            input: { file_path: 'src/main.tsx' },
            result:
              "import { initialTheme } from './theme'\n\ndocument.documentElement.dataset.theme = initialTheme",
          },
          {
            kind: 'text',
            text: 'Two places: `src/theme.ts` defines `initialTheme` and `src/main.tsx` applies it to `<html>` before React mounts.',
          },
        ],
      },
      {
        agentId: 'b7e2d8f0a6c3',
        agentType: 'general-purpose',
        description: 'Check the contrast of the dark tokens',
        state: 'running',
        minutesAgo: 1,
        entries: [
          { kind: 'user', text: 'Check every dark theme token pair against WCAG AA.' },
          {
            kind: 'tool',
            name: 'Read',
            input: { file_path: 'src/theme.ts' },
            result: "export const dark = { background: '#101010', text: '#EDEDED', muted: '#8F8F8F' }",
          },
        ],
      },
    ],
  },
  {
    id: '9a4e3c12-7d6b-4e8f-a1c0-3b2d5f7e8a33',
    profileId: 'personal',
    repo: 'acme-api',
    branch: 'main',
    title: 'Fix the flaky checkout test',
    state: 'idle',
    minutesAgo: 24,
    permissionMode: 'default',
    entries: [
      { kind: 'user', text: 'checkout.test.ts fails about once in ten runs on CI. Make it deterministic.' },
      {
        kind: 'tool',
        name: 'Bash',
        input: { command: 'pnpm test checkout --repeat 20', description: 'Repeat the checkout tests' },
        result: ' ✓ test/checkout.test.ts (12 tests) × 20\n\n Tests  240 passed (240)',
      },
      {
        kind: 'text',
        text: 'The test depended on the wall clock. It now uses a fixed clock, and 20 repeated runs pass.',
      },
    ],
  },
  {
    id: '4c7b1d93-2e5f-4a6c-9b08-1f3e6d2a7c44',
    profileId: 'openrouter',
    repo: 'design-system',
    branch: 'main',
    title: 'Audit the button contrast',
    state: 'idle',
    minutesAgo: 75,
    permissionMode: 'plan',
    entries: [
      { kind: 'user', text: 'Check every button variant against WCAG AA and list the ones that fail.' },
      {
        kind: 'text',
        text: 'Two variants fail AA on the dark theme: `ghost` (3.1:1) and `link` (3.8:1). Plan: darken their text token one step.',
      },
    ],
  },
  {
    id: '7e2f9b05-8c1d-4d3a-b6e7-5a0c2f9d1e55',
    profileId: 'personal',
    repo: 'blog',
    branch: 'main',
    title: 'Draft the v2 launch post',
    state: 'idle',
    minutesAgo: 190,
    permissionMode: 'default',
    entries: [
      { kind: 'user', text: 'Draft a short launch post for v2 from CHANGELOG.md.' },
      {
        kind: 'text',
        text: 'Draft saved to `posts/v2-launch.md`: three sections (what changed, how to upgrade, thanks).',
      },
    ],
  },
  {
    id: '1d8a6f27-3b9e-4c2d-8f15-6e4a0b3c7d66',
    profileId: 'work',
    repo: 'infra',
    worktree: 'terraform-1-9',
    branch: 'chore/terraform-1.9',
    title: 'Upgrade the Terraform providers',
    state: 'ended',
    minutesAgo: 26 * 60,
    permissionMode: 'default',
    entries: [
      { kind: 'user', text: 'Upgrade the AWS and Cloudflare providers and fix what breaks.' },
      { kind: 'text', text: 'Both providers are upgraded; `terraform plan` shows no changes.' },
    ],
  },
]
