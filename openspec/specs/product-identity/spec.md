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
The data directory SHALL be the `REMOTE_HARNESS_HOME` (or `CLAUDE_REMOTE_HOME`) override, else `~/.remote-harness`. An install whose data still lives in `~/.claude-remote` SHALL have that directory moved to `~/.remote-harness` once, by the installer (also when it runs as `remote-harness update`) or by the CLI when it starts, leaving a symbolic link `~/.claude-remote` → `~/.remote-harness` behind so that sessions, hooks and launchers still running from the old path keep working until they are regenerated or end. With the override set, or when `~/.remote-harness` already exists, nothing MUST be moved.

#### Scenario: Existing install
- **WHEN** only `~/.claude-remote` exists and the user runs `remote-harness update`
- **THEN** the directory is moved to `~/.remote-harness`, `~/.claude-remote` becomes a link to it, and the daemon reads and writes `~/.remote-harness`

#### Scenario: Session from before the move
- **WHEN** a Claude Code session started before the update runs a hook whose command names `~/.claude-remote/hook-secret.curlrc`
- **THEN** the hook reaches the daemon through the link

#### Scenario: New install
- **WHEN** neither directory exists
- **THEN** the daemon uses `~/.remote-harness`

#### Scenario: Override
- **WHEN** `REMOTE_HARNESS_HOME=/tmp/x` is set and `~/.claude-remote` exists
- **THEN** nothing is moved and the daemon uses `/tmp/x`

### Requirement: Product accent and agent colors
Amber `#E8A33D` SHALL be the product accent of Remote Harness in the app, the notifications and the brand surfaces. Claude orange `#D97757` SHALL identify the Claude Code agent only, next to the other agents' colors (Codex `#2FBF8F`, Gemini `#E3729E`, Kimi `#5B9BF5`, Qwen `#8C6CF5`), and MUST NOT be used as the product accent. The warning color SHALL be `#F3DC7A`, distinct from the accent, so a waiting state never reads as the brand color.

#### Scenario: Running and waiting sessions
- **WHEN** one session is running and another waits for a permission
- **THEN** the running state uses the amber accent and the waiting state uses the warning yellow

#### Scenario: Android notification accent
- **WHEN** a push notification is shown on Android
- **THEN** its accent color is amber

### Requirement: Brand mark
The product mark SHALL be "Cursor Signal": a terminal cursor block with the `>` prompt cut out of it and three signal arcs leaving it to the right, drawn in a 256 box (the block 62 × 104 at (34, 76) with a corner radius of 13, the prompt cut out by a 16-unit round stroke; the arcs concentric on the block's right edge (96, 128) with radii 36, 76 and 116, spanning ±40°, stroke 22), in the amber accent, in two weights: regular for the app icon, splash, README and web; bold under 24 px (menu bar, notification icon, favicon, Live Activity, Linux tray), with a wider cutout and thicker arcs so neither closes up. The mark SHALL be defined once in `apps/mobile/scripts/icons.mts` and every brand asset SHALL be generated from it: the app assets, the brand banner `docs/brand/og.png` (1200×630, mark, product name, tagline and agent chips, in JetBrains Mono) used as the README header, the Linux tray icon (a symbolic SVG of the bold mark) and the Google Play feature graphic; the designer's SVG sources (amber on warm dark, inverted, light and mono) SHALL be kept under `docs/design/identity/branding/`. The copies drawn by hand SHALL use the same geometry: the sessions list header mark in the app, the site's inline marks and its favicon (the bold mark in a 78 % box on `#1C1A17` with 22 % corners), the macOS menu bar glyph and the Windows notification-area icon (the bold mark as a template image at 18 pt / the small icon size). Those two tray glyphs SHALL encode the state in shape and opacity, never in color but the amber dot: `idle` the plain mark; `working` the block filled solid, the prompt gone like a busy cursor; `waiting` the amber dot over the outer arc's upper end; `offline` the mark at 40 % opacity. The installer, setup and doctor banners SHALL draw the mark in block characters (the block with the prompt cut out and the three arcs) next to the words REMOTE / HARNESS, in the amber accent, and MUST fit an 80-column terminal. No brand asset MAY show the Claude spark. No generated asset MAY draw a glow, shadow or gradient behind the mark on the icon: the app icon SHALL be the mark in a 78 % box centered on the flat warm dark `#1C1A17`, and the favicon, the Live Activity icon, the brand banner and the Google Play feature graphic SHALL render a flat background plus the mark, nothing else. The brand banner's agent chips SHALL show a small drawn glyph for each agent instead of a two-letter code, and its tagline and chip labels SHALL stay legible at the README's 720 px display width.

#### Scenario: macOS menu bar
- **WHEN** the daemon's tray helper runs on macOS with no session working
- **THEN** the status item shows the bold Cursor Signal as a template image, tinted by the system for light and dark menu bars; while a session works the block is solid, while one waits an amber dot sits over the outer arc, and with the daemon offline the glyph is drawn at 40 %

#### Scenario: Windows notification area
- **WHEN** the daemon's tray helper runs on Windows
- **THEN** the small icon is the bold Cursor Signal in black on a light taskbar and white on a dark one, with the same four states as the menu bar

#### Scenario: App header and site
- **WHEN** the sessions list, the landing page, the install link page or the browser tab shows the mark
- **THEN** it is the Cursor Signal drawn from the same geometry as the generated assets, the favicon on the flat warm dark with rounded corners

#### Scenario: Setup banner
- **WHEN** the setup wizard starts in an 80-column terminal
- **THEN** it prints the block-character Cursor Signal next to REMOTE / HARNESS, in amber, every line within 80 columns

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

### Requirement: Identifiers on the computer
Everything Remote Harness registers on the computer SHALL carry its own name: the launchd label and bundle identifier `com.alvyntech.remoteharness.daemon`, the systemd unit `remote-harness.service`, the `service` attribute `remote-harness` of its Keychain and Secret Service entries, the default tmux session `remote-harness`, the hook headers `x-remote-harness-secret`, `x-remote-harness-pane` and `x-remote-harness-profile`, the launcher variables `REMOTE_HARNESS_PROFILE`, `REMOTE_HARNESS_NO_ATTACH`, `REMOTE_HARNESS_TMUX`, `REMOTE_HARNESS_<AGENT>_BIN`, `REMOTE_HARNESS_EXEC` and `REMOTE_HARNESS_PROMPT`, the backup suffix `.bak-remote-harness` and the shell PATH block markers `# >>> remote-harness >>>` / `# <<< remote-harness <<<`. `remote-harness update`, `install` and `service install` SHALL migrate an install made before the rename without breaking it: the legacy LaunchAgent (`tech.doctorx.claude-remote`) or unit (`claude-remote.service`) is unloaded and removed before the new one loads, the secrets stored under the legacy service are copied to the new one (the legacy entries are left in place), a live tmux session `claude-remote` is renamed to the configured session when that one does not exist and `config.json` does not pin the old name, and the legacy PATH block is replaced by the new one. For the sessions already running, the daemon SHALL accept the legacy hook headers and the launchers SHALL also export `CLAUDE_REMOTE_PROFILE`, and the generated hook commands SHALL read `REMOTE_HARNESS_PROFILE` with `CLAUDE_REMOTE_PROFILE` as fallback. The `claude-remote` CLI alias stays (see "CLI command and alias").

#### Scenario: Update migrates the service
- **WHEN** `remote-harness update` finishes on a Mac whose LaunchAgent is `tech.doctorx.claude-remote`
- **THEN** that agent is booted out and its plist removed, `com.alvyntech.remoteharness.daemon.plist` is written and bootstrapped, and `remote-harness service status` shows the new label loaded

#### Scenario: Secrets follow
- **WHEN** the daemon identity and a profile's provider key are stored under the Keychain service `claude-remote` and the update finishes
- **THEN** both exist under the service `remote-harness`, the daemon reads them from there, and the paired devices keep working without pairing again

#### Scenario: tmux session renamed
- **WHEN** the Remote Harness tmux server has a session `claude-remote` with live windows, none named `remote-harness`, and `config.json` has no `tmuxSession`
- **THEN** the session is renamed to `remote-harness`, its windows and panes untouched, and the next launcher opens its window there

#### Scenario: Pinned session name
- **WHEN** `config.json` sets `"tmuxSession": "claude-remote"`
- **THEN** nothing is renamed and the launchers keep using that session

#### Scenario: Hooks of an older session
- **WHEN** a session started before the update sends a hook with the `x-claude-remote-*` headers and `$CLAUDE_REMOTE_PROFILE` from its pane
- **THEN** the daemon accepts it exactly as a hook with the new headers
