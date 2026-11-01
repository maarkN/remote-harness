# product-identity Specification

## Purpose
Defines the product identity shared by the app, the daemon, the website and the stores: the name, the brand mark and its assets, the colors, and the agent-neutral copy.

## Requirements

### Requirement: Product name
Every user-facing text of the app, the daemon CLI, the installers and the push notifications SHALL name the product "Remote Harness".

#### Scenario: CLI help
- **WHEN** the user runs `remote-harness --help`
- **THEN** the description names Remote Harness

### Requirement: CLI command and alias
The daemon CLI SHALL be installed as `remote-harness` and MUST keep `claude-remote` as an alias that runs the same commands.

#### Scenario: Old command
- **WHEN** the user runs `claude-remote update` after updating
- **THEN** the update runs as with `remote-harness update`

### Requirement: Environment variables
Every `REMOTE_HARNESS_<NAME>` variable SHALL take precedence; when it is unset, the matching `CLAUDE_REMOTE_<NAME>` MUST be used.

#### Scenario: Legacy variable
- **WHEN** only `CLAUDE_REMOTE_HOME=/tmp/x` is set
- **THEN** the daemon uses `/tmp/x` as its data directory

### Requirement: Data directory
The data directory SHALL be the `REMOTE_HARNESS_HOME` (or `CLAUDE_REMOTE_HOME`) override, else `~/.remote-harness` when it exists, else `~/.claude-remote` when it exists, else `~/.remote-harness`. Existing data MUST NOT be moved.

#### Scenario: Existing install
- **WHEN** only `~/.claude-remote` exists
- **THEN** the daemon keeps reading and writing `~/.claude-remote`

#### Scenario: New install
- **WHEN** neither directory exists
- **THEN** the daemon uses `~/.remote-harness`

### Requirement: Product accent and agent colors
Amber `#E8A33D` SHALL be the product accent of Remote Harness in the app, the notifications and the brand surfaces. Claude orange `#D97757` SHALL identify the Claude Code agent only, next to the other agents' colors (Codex `#2FBF8F`, Gemini `#E3729E`, Kimi `#5B9BF5`, Qwen `#8C6CF5`), and MUST NOT be used as the product accent. The warning color SHALL be `#F3DC7A`, distinct from the accent, so a waiting state never reads as the brand color.

#### Scenario: Running and waiting sessions
- **WHEN** one session is running and another waits for a permission
- **THEN** the running state uses the amber accent and the waiting state uses the warning yellow

#### Scenario: Android notification accent
- **WHEN** a push notification is shown on Android
- **THEN** its accent color is amber

### Requirement: Brand mark
The product mark SHALL be "Cursor Signal": a terminal cursor block with the `>` prompt cut out of it and three signal arcs leaving it to the right, drawn in a 256 box (the block 62 × 104 at (34, 76) with a corner radius of 13, the prompt cut out by a 16-unit round stroke; the arcs concentric on the block's right edge (96, 128) with radii 36, 76 and 116, spanning ±40°, stroke 22), in the amber accent, in two weights: regular for the app icon, splash, README and web; bold under 24 px (menu bar, notification icon, favicon, Live Activity, Linux tray), with a wider cutout and thicker arcs so neither closes up. The mark SHALL be defined once in `apps/mobile/scripts/icons.mts` and every brand asset SHALL be generated from it: the app assets, the brand banner `docs/brand/og.png` (1200×630, mark, product name, tagline and agent chips, in JetBrains Mono) used as the README header, the Linux tray icon (a symbolic SVG of the bold mark) and the Google Play feature graphic; the designer's SVG sources (amber on warm dark, inverted, light and mono) SHALL be kept under `docs/design/identity/branding/`. The macOS menu bar glyph (a template image drawn from the bold mark), the Windows tray glyph, the app header mark, the site favicon and the installer banner SHALL draw the same geometry. The installer and setup banner SHALL draw the mark in block characters next to the words REMOTE / HARNESS, in the amber accent, and MUST fit an 80-column terminal. No brand asset MAY show the Claude spark. No generated asset MAY draw a glow, shadow or gradient behind the mark on the icon: the app icon SHALL be the mark in a 78 % box centered on the flat warm dark `#1C1A17`, and the favicon, the Live Activity icon, the brand banner and the Google Play feature graphic SHALL render a flat background plus the mark, nothing else. The brand banner's agent chips SHALL show a small drawn glyph for each agent instead of a two-letter code, and its tagline and chip labels SHALL stay legible at the README's 720 px display width.

#### Scenario: macOS menu bar
- **WHEN** the daemon's tray helper runs on macOS
- **THEN** the status item shows the bold mark as a template image, tinted by the system for light and dark menu bars

#### Scenario: Setup banner
- **WHEN** the setup wizard starts in an 80-column terminal
- **THEN** it prints the block-character mark next to REMOTE / HARNESS, in amber

#### Scenario: README header
- **WHEN** the repository README is opened on GitHub
- **THEN** its header is the brand banner with the mark, the name and the agent chips, with no glow behind the mark and legible tagline and chip text at 720 px wide

#### Scenario: App icon at small sizes
- **WHEN** the app icon is rendered at 29pt, 40pt or 60pt, or inside the Android adaptive icon mask
- **THEN** only the flat background and the mark are visible, with no glow softening its edges

#### Scenario: Prompt cutout under 24 px
- **WHEN** the notification icon (24 dp), the favicon (16 and 32 px), the Live Activity icon (48 pt) and the Linux symbolic icon (22 px) are rendered
- **THEN** they use the bold weight and the `>` cut out of the block stays visible

#### Scenario: Regenerating from the sources
- **WHEN** a developer runs `pnpm --filter @remote-harness/mobile icons`
- **THEN** every asset is rewritten from the Cursor Signal geometry and no PNG is edited by hand

### Requirement: Agent-neutral copy
Product copy in the app, the daemon CLI, the installers, the push notifications, the READMEs and store metadata SHALL describe Remote Harness as a tool for coding agents ("follow and drive your coding agents from your phone"), never as a Claude Code-only tool. Texts that address or name the agent of a session SHALL use the agent's display name when the session's agent is known and "the agent" (translated, capitalized at the start of a sentence) otherwise, through one helper that every call site uses. "Claude Code" SHALL remain only where the text really refers to Claude Code: profiles and accounts, hooks, transcripts, Claude Code's own features (such as `--worktree`) and prerequisites.

#### Scenario: Composer of a session with an unknown agent
- **WHEN** the app shows the composer of a session whose agent is not known
- **THEN** the placeholder reads "Message the agent…" (pt-BR "Mensagem para o agente…", es-ES "Mensaje para el agente…")

#### Scenario: Question from a known agent
- **WHEN** a session whose agent is known as Codex asks a question
- **THEN** the card title reads "Codex has a question"

#### Scenario: Question push
- **WHEN** the daemon sends the push for a pending question
- **THEN** its title reads "The agent is waiting for your answer" in the daemon's language

#### Scenario: Installer step about accounts
- **WHEN** the setup guide describes the installer
- **THEN** it still says "Claude Code accounts", because that is what the installer lists

### Requirement: Machine wording
User-facing texts of the app SHALL call the paired computer "machine" and MUST NOT say "daemon". Wherever a sentence refers to it, the app SHALL use the machine name: the alias chosen in the app when one exists, else the host name the daemon reports in `auth.ok`, else the generic "your machine" (translated; capitalized at the start of a sentence). The catalogs SHALL express this with `{{machine}}` / `{{Machine}}` placeholders that resolve automatically, so every call site keeps calling `t(key)`. Settings SHALL title the connection section "Machine", show the host name, and offer "Forget this machine". Texts that ask the user to run a command SHALL keep the command verbatim and say where to run it. Code identifiers, protocol fields and the CLI's own texts are not covered.

#### Scenario: Connecting with a known host
- **WHEN** the app reconnects to a computer whose host name is "MacBook Pro"
- **THEN** the banner reads "connecting to MacBook Pro…" and a timeout reads "MacBook Pro did not respond."

#### Scenario: Pairing before any handshake
- **WHEN** the pairing screen cannot reach the computer
- **THEN** the error reads "Couldn't connect to your machine." (pt-BR "sua máquina", es-ES "tu máquina")

#### Scenario: Explicit variable
- **WHEN** a call site passes `{ machine: 'Studio' }`
- **THEN** that value is used instead of the registered name

#### Scenario: Settings
- **WHEN** Settings opens while connected to "MacBook Pro"
- **THEN** the first section is "Machine" with the row "name · MacBook Pro" and the destructive button "Forget this machine"
