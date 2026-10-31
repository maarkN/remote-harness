/**
 * Reference catalog of the landing page: its shape is `WebMessages`, and pt-BR / es-ES must match
 * it key for key (a test walks the three). Texts are plain strings; `code` spans and
 * [label](url) links are the only markup (see `html.ts`). Product names are never translated.
 */
import type { MarkId } from '../agent-marks.ts'

export const enUS = {
  meta: {
    title: 'Remote Harness: follow and drive your coding agents from your phone',
    description:
      'Self-hosted: Claude Code, Codex, Gemini CLI or Kimi CLI runs in tmux on your own machine, Remote Harness streams the conversation to your phone, encrypted end to end. Permissions, prompts and new sessions from anywhere.',
  },
  nav: {
    skip: 'Skip to content',
    how: 'How it works',
    features: 'Features',
    security: 'Security',
    install: 'Install',
    docs: 'Docs',
    github: 'GitHub',
    language: 'Language',
    menu: 'Menu',
  },
  hero: {
    eyebrow: 'End-to-end encrypted · tmux · open source',
    title: 'Follow and drive your coding agents from your phone.',
    lead: 'Claude Code, Codex, Gemini CLI or Kimi CLI runs in tmux on your own machine. Remote Harness streams the conversation to your phone from anywhere, encrypted end to end, so you can read what the agent did, answer its permission requests, send the next prompt and start new sessions.',
    install: 'Install on your machine',
    app: 'Get the app',
    platforms: 'macOS · Linux · Windows (WSL2)',
    phones: 'iOS · Android',
    terms: 'MIT, no account, no VPN',
    carousel: {
      label: 'Screens of the app',
      role: 'carousel',
      previous: 'Previous screen',
      next: 'Next screen',
    },
    slides: [
      { name: 'Sessions', label: 'The session list in the app, with a permission request waiting' },
      {
        name: 'Conversation',
        label: 'A session in the app: the prompt, the agent’s reply, its tool calls and the message box',
      },
      {
        name: 'Live status',
        label: 'The lock screen with two live activities: a session working and one waiting for a permission',
      },
    ],
  },
  mock: {
    title: 'Sessions',
    host: 'MacBook Pro',
    count: '· 5 sessions',
    filters: ['all', 'Personal', 'Work'],
    waiting: 'Waiting for you · 1',
    timer: '0:52',
    permission: {
      title: 'Add rate limit on login',
      tool: 'Bash',
      command: 'gh pr create --fill --base main',
    },
    deny: 'Deny',
    always: 'Always',
    allow: 'Allow',
    states: { running: 'running', waiting: 'waiting', idle: 'idle', ended: 'ended' },
    profiles: { personal: 'Personal', work: 'Work' },
    sessions: [
      {
        title: 'Migrate landing to Tailwind 4',
        folder: '~/projects/landing',
        branch: 'main' as string | null,
        state: 'running',
        profile: 'personal',
        ago: '2 min',
      },
      {
        title: 'Add rate limit on login',
        folder: '~/projects/acme-api',
        branch: 'feat/rate-limit' as string | null,
        state: 'waiting',
        profile: 'work',
        ago: '4 min',
      },
      {
        title: 'Fix crash on onboarding',
        folder: '~/projects/acme-mobile',
        branch: 'fix/onboarding' as string | null,
        state: 'idle',
        profile: 'work',
        ago: '12 min',
      },
      {
        title: 'Write post about tmux + agents',
        folder: '~/projects/blog',
        branch: 'main' as string | null,
        state: 'idle',
        profile: 'personal',
        ago: '40 min',
      },
      {
        title: 'Review deploy pipeline',
        folder: '~/projects/acme-infra',
        branch: null as string | null,
        state: 'ended',
        profile: 'work',
        ago: '2 h',
      },
    ],
    conversation: {
      title: 'Fix crash on onboarding',
      folder: '~/projects/acme-mobile',
      branch: 'fix/onboarding',
      mode: 'accept edits',
      model: 'sonnet',
      context: '38% context',
      prompt:
        'The app crashes on the second onboarding step when the user skips the photo. Find out why and fix it',
      intro: 'I’ll look at how the onboarding steps read the photo.',
      tools: [
        { name: 'Grep("photo" in src/onboarding)', result: 'src/onboarding/Profile.tsx:31: photo.uri' },
        { name: 'Edit(src/onboarding/Profile.tsx)', result: 'ok · +3 −1' },
        { name: 'Bash(pnpm test onboarding)', result: '✓ 12 tests · 1.4 s' },
      ],
      reply: 'Fixed. `Profile.tsx` read `photo.uri` before checking that a photo was picked:',
      points: ['the step now falls back to the initials avatar', 'a new test covers skipping the photo'],
      placeholder: 'Message Claude Code…',
    },
    live: {
      date: 'Tuesday, October 21',
      working: {
        who: 'Personal · MacBook Pro',
        title: 'Migrate landing to Tailwind 4',
        folder: '~/projects/landing',
        timer: '4:36',
        sub: 'working',
        state: 'Working',
        step: 'Bash · pnpm',
        tools: '6 tools',
      },
      waiting: {
        who: 'Work · MacBook Pro',
        title: 'Add rate limit on login',
        folder: '~/projects/acme-api',
        timer: '0:52',
        sub: 'waiting',
        state: 'Waiting for you',
        step: 'permission · Bash',
        tools: '9 tools',
      },
    },
  },
  agents: {
    label: 'Works with',
    claude: 'Claude Code',
    openrouter: 'OpenRouter models',
    openrouterNote: 'via profiles',
    codex: 'Codex CLI',
    gemini: 'Gemini CLI',
    kimi: 'Kimi',
    qwen: 'Qwen Code',
    soon: 'soon',
  },
  how: {
    eyebrow: 'How it works',
    title: 'Your phone, your machine. Nothing in between can read it.',
    lead: 'Sessions run inside tmux. The agent reports what happens through its native hooks, a small daemon on the machine bridges both to the phone, and end-to-end encryption keeps it all private.',
    phone: {
      title: 'Your phone',
      body: 'Native iOS and Android app. Reads the conversation, answers permissions, sends prompts, keys, photos and voice. Push and live status, with no content inside.',
    },
    link1: { top: 'WebSocket: direct or relay', bottom: 'Noise, end to end · only paired devices' },
    machine: {
      title: 'Your machine',
      body: 'The `remote-harness` daemon: tails transcripts, drives tmux, receives the agent’s hooks on 127.0.0.1. One line to install, a Login Item or systemd unit to keep running.',
    },
    link2: { top: 'hooks + tmux', bottom: 'send-keys · capture-pane' },
    agents: {
      title: 'Your agents, in tmux',
      body: 'One window per session, one alias per profile, for Claude Code, Codex, Gemini CLI or Kimi CLI.',
      aliases: [
        { mark: 'claude' as MarkId, text: 'personal → ~/.claude' },
        { mark: 'claude' as MarkId, text: 'work → ~/.claude-work' },
        { mark: 'codex' as MarkId, text: 'codex → ~/.codex' },
        { mark: 'gemini' as MarkId, text: 'gem → ~/.gemini' },
        { mark: 'kimi' as MarkId, text: 'km → ~/.kimi' },
        { mark: 'claude' as MarkId, text: 'openrouter → ~/.claude-openrouter' },
      ],
    },
    steps: [
      {
        title: 'Install on the machine',
        body: 'One command. It checks tmux, git, ripgrep and Node, finds your profiles, and installs the launchers.',
      },
      {
        title: 'Scan the QR code',
        body: 'The setup shows it at the end (or `remote-harness pair`). At home or away, the phone finds the machine, done.',
      },
      {
        title: 'Run your alias',
        body: '`work` opens Claude Code in tmux with that profile. The session shows up on the phone, fully controllable.',
      },
    ],
  },
  features: {
    eyebrow: 'Features',
    title: 'Everything the terminal shows, and the parts the terminal can’t.',
    items: [
      {
        glyph: '≡',
        title: 'One list, every profile',
        body: 'Sessions from all your profiles, sorted by what moved last, with a “waiting for you” strip on top.',
      },
      {
        glyph: '●',
        title: 'Live conversation',
        body: 'Markdown, thinking, tool calls, diffs and results, streamed as they happen and paginated back to the start.',
      },
      {
        glyph: '⛨',
        title: 'Permissions from your pocket',
        body: 'Allow, deny or always allow. “Always” is written as a rule by the agent itself and undoable from the CLI.',
      },
      {
        glyph: '⏎',
        title: 'Queue or send now',
        body: 'Line up follow-ups while the agent works; they go in order when the turn ends. Hold to send immediately.',
      },
      {
        glyph: '▣',
        title: 'Raw terminal',
        body: 'The tmux pane itself, for menus and anything the structured view doesn’t cover, with a key bar for Esc, Ctrl+C, arrows and Tab.',
      },
      {
        glyph: '⎇',
        title: 'Start, resume, close',
        body: 'New sessions in any folder, optionally in their own git worktree. Resume read-only ones. Close with worktree clean-up that never discards work silently.',
      },
      {
        glyph: '◔',
        title: 'Live status',
        body: 'Lock screen and Dynamic Island on iOS, a silent notification on Android: state, step type and elapsed time, never the text.',
      },
      {
        glyph: '⌥',
        title: 'Subagents, voice, photos',
        body: 'Follow subagents and background tasks, dictate prompts on-device, attach photos. Autocomplete for @files and /commands.',
      },
    ],
  },
  security: {
    eyebrow: 'Privacy & security',
    title: 'The daemon is a remote shell, so it’s locked down by default.',
    items: [
      {
        title: 'The relay can’t read it',
        body: 'At home the app talks to the daemon directly; elsewhere through a connection relay. Both paths are encrypted end to end with Noise and per-device keys, so the relay only forwards bytes it can’t read, and keeps no logs.',
      },
      {
        title: 'Keys per device',
        body: "Each phone pairs with a single-use code that expires in 5 minutes and gets its own keys, kept in the Keychain (macOS), Secret Service (Linux) or the phone's secure storage. Revoke one any time.",
      },
      {
        title: 'Content-free push',
        body: 'Notifications carry a title, a profile and a session id. The live status adds the session name and folder, nothing from the conversation.',
      },
      {
        title: 'No bypass',
        body: 'The app never offers the agent’s “bypass permissions” mode. Edits to your dotfiles are merged, backed up and fully reversible.',
      },
      {
        title: 'Opt-in only',
        body: 'Nothing is sent anywhere unless you choose it: push through your own Firebase project or the content-free relay, error reports and performance data, all without session content.',
      },
      {
        title: 'Open source',
        body: 'MIT licensed, built in the open with OpenSpec. Read [SECURITY.md](https://github.com/maarkN/remote-harness/blob/main/SECURITY.md) to report a problem.',
      },
    ],
  },
  install: {
    eyebrow: 'Install',
    title: 'One line on the machine, one scan on the phone.',
    tabUnix: 'macOS · Linux',
    tabWindows: 'Windows (WSL2)',
    copy: 'Copy',
    copied: 'Copied',
    copyLabel: 'Copy the install command',
    unixNote:
      'Checks the system, installs what’s missing (Homebrew, apt, dnf, pacman or zypper), builds the daemon and opens the guided setup.',
    windowsNote:
      'In PowerShell. Sets up WSL2 with Ubuntu when it is missing (reboot if asked, then run it again) and then runs the Linux installer inside it.',
    requirements: [
      'Node 24+ (bundled if missing)',
      'tmux',
      'git',
      'ripgrep',
      'claude, codex, gemini or kimi on PATH',
    ],
    appTitle: 'Get the app',
    ios: {
      title: 'iPhone & iPad',
      detail: 'Install over the air · registered devices · iOS 17+',
      source: 'Build from source today · TestFlight soon · iOS 17+',
      note: 'The iPhone & iPad build installs only on registered devices: [how to get yours added](/en/docs/getting-started/#registering-an-iphone-or-ipad), or build it from source.',
    },
    android: { title: 'Android', detail: 'Google Play (testing) · Android 10+' },
    appNote:
      'Nothing else to install on the phone. Installed the app first? Its pairing screen walks you through the machine setup.',
  },
  faq: {
    eyebrow: 'Docs & FAQ',
    title: 'Questions people ask first',
    lead: 'The full guide is in [the documentation](/en/docs/): getting started, using the app, the daemon CLI, security, troubleshooting.',
    items: [
      {
        q: 'Does it work away from home?',
        a: 'Yes: directly at home, through the end-to-end encrypted connection relay elsewhere, with no port forwarding and no VPN. The machine must be awake; the Troubleshooting page of the docs covers sleep and lock settings.',
      },
      {
        q: 'Which agents are supported?',
        a: 'Claude Code, Codex CLI, Gemini CLI and Kimi CLI, with every profile (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `~/.gemini`, `KIMI_SHARE_DIR`) in one list, including Claude Code profiles routed through OpenRouter. Qwen Code is on the roadmap.',
      },
      {
        q: 'Can it run my agent unsupervised?',
        a: 'Only as far as the agent’s own permission modes allow. The app offers default, accept edits, plan and auto; it never offers bypass. Every permission still goes through you, from the phone or the machine.',
      },
      {
        q: 'What about sessions started outside tmux?',
        a: 'They still show up, read-only. Resume one from the phone and it reopens inside tmux, fully controllable.',
      },
      {
        q: 'Is there a cloud component?',
        a: 'Only relays that can’t read anything. Away from home the connection relay forwards end-to-end encrypted traffic (or run your own), and optional push goes through FCM (your Firebase project or the content-free push relay). Nothing stores your sessions.',
      },
      {
        q: 'Does the daemon need a Mac?',
        a: 'No: macOS, Linux (systemd) and Windows through WSL2 are all supported. The app runs on iOS and Android.',
      },
    ],
  },
  footer: {
    docs: 'Docs',
    github: 'GitHub',
    releases: 'Releases',
    security: 'Security',
    privacy: 'Privacy',
    license: 'MIT',
    legal:
      'Remote Harness is an independent project and is not affiliated with, endorsed by or sponsored by Anthropic, OpenAI, Google, Moonshot AI, Alibaba Cloud or OpenRouter. “Claude” and “Claude Code” are trademarks of Anthropic, PBC; “Codex” is a trademark of OpenAI; “Gemini” is a trademark of Google LLC; Kimi, Qwen and OpenRouter and their logos belong to their owners. Screenshots show demo sessions.',
    contributors: 'Contributors',
    madeBy: 'Made by',
  },
  docs: {
    title: 'Documentation',
    home: 'Home',
    pages: 'Pages',
    search: 'Search the docs',
    noResults: 'No results',
    onThisPage: 'On this page',
    previous: 'Previous',
    next: 'Next',
    applies: 'Applies to {{version}}',
    fallback: 'This page is not translated yet; here is the English version.',
  },
  installPage: {
    title: 'Install Remote Harness',
    description:
      'One command installs Remote Harness on macOS, Linux or Windows (WSL2): it checks the system, builds the daemon and opens the guided setup.',
    eyebrow: 'Install',
    heading: 'One line in a terminal on your computer.',
    lead: 'The same address works everywhere: curl and wget get the macOS · Linux script, PowerShell gets the Windows one, and a browser gets this page.',
    unix: 'macOS · Linux · WSL',
    windows: 'Windows (PowerShell)',
    detected: 'For your system',
    others: 'Other systems',
    phone: 'Run it in a terminal on the computer where your coding agent runs, not on the phone.',
    version: 'Installing `{{ref}}` instead of the latest release.',
    next: 'Step by step, with what to do after the setup: [getting started]({{docs}}).',
  },
  appLink: {
    title: 'Install the app',
    lead: 'Remote Harness for your phone, built and published from your computer.',
    version: 'Version {{version}} ({{build}}) · {{date}}',
    notPublished: 'Not published yet.',
    size: '{{size}} MB',
    ios: {
      title: 'iPhone & iPad',
      install: 'Install',
      registered:
        'Only iPhones and iPads registered in the developer team can install this build ([how to get yours added](/en/docs/getting-started/#registering-an-iphone-or-ipad)). Open this page in Safari.',
      developerMode:
        'The first time, iOS asks to turn on Developer Mode: Settings → Privacy & Security → Developer Mode, then restart.',
    },
    android: {
      title: 'Android',
      download: 'Download the APK',
      unknownApps:
        'Your browser asks to allow installing unknown apps (Settings → Apps → Special app access → Install unknown apps). Then open the downloaded file.',
      updates: 'A newer APK installs over the previous one and keeps your pairing.',
    },
    qr: 'Scan with the phone’s camera to open this page there.',
    qrLabel: 'QR code of this page',
    showAll: 'Not your device? Show all options',
    private: 'Private link: anyone who has it can download these builds. Do not post it publicly.',
  },
  notFound: {
    title: 'Page not found',
    body: 'There is nothing at this address. The landing page explains the app; the repository has the code and the docs.',
    home: 'Back to the landing',
    github: 'Open the repository',
  },
}

export type WebMessages = typeof enUS
