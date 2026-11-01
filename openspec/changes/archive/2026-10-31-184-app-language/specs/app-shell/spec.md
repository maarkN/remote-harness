## MODIFIED Requirements

### Requirement: Authenticated connection
When starting with paired credentials, the app SHALL connect to the daemon and send `auth` as the first message; without credentials, it MUST open the pairing screen, preceded on the very first launch (no language ever saved) by the language step of `i18n` "App language".

#### Scenario: Not paired
- **WHEN** the app opens for the first time
- **THEN** the language step is shown, and Continue opens the pairing screen

#### Scenario: Not paired, language already chosen
- **WHEN** the app opens with no computer paired and a language saved on the device
- **THEN** the pairing screen is shown at once

### Requirement: Settings screen
The settings screen SHALL be organized as: **Machine** (the connection pill; the machine name, the alias when set else the daemon's hostname, with an Edit action that saves or clears the alias; one line `host:port · remote-harness <daemon version> · protocol <n>` leaving unknown parts out; `Forget this machine`), **Appearance** (a Theme row naming the resolved theme that opens the theme picker modal), **Language** (the app language: `Same as the phone`, `Português (Brasil)`, `English (US)`, `Español`; see `i18n` "App language"), **App icon** (an App icon row naming the current choice that opens the icon picker modal — Match theme, Original, and one per theme; see "App icon follows the theme"), **Profiles** (one row per profile with the agent badge, the name in the profile color, the dashed `via <provider>` chip when the profile has a provider, and `<agent> · <config dir> · alias <id>`; tapping opens a details sheet with the agent, the alias, the config dir, the profile's notifications toggle and, for a profile with a provider, the provider, its default model and the credits left, or the hint to run `remote-harness provider key <id>` when no key is stored), **New session** (`Open the session after creating it` toggle, on by default, per device), **Keyboard** (`Return key sends` toggle, off by default, per device, with the hint that the on-screen keyboard then has no new line), **Notifications** (`Push notifications` toggle for this phone with the hint "Only this phone · never the conversation", showing the push status and test while on; `Live status` toggle; a `Muted` row with `N profiles · M sessions` that opens a sheet with the per-profile switches and the muted sessions, each unmutable), **Permissions** (opens the Permissions screen, which lists every system permission the app and the computer rely on, its status, why it's needed, and how to fix it), **Daemon** (the daemon version and update channel with a `main` / `development` selector, `Check for updates`, the available version, `Update the computer` after a confirmation that warns about a downgrade and about busy sessions, the run progress and its outcome; for a daemon without remote updates, the `remote-harness update` command), **Voice** (transcription language) and **App** (version, update and channel, `Check for updates`, `Documentation`, `Report a problem`). All texts MUST be translated.

#### Scenario: Rename the machine
- **WHEN** the user taps Edit on the Machine card, types "MacBook Pro" and saves
- **THEN** the card and every `{{machine}}` text show "MacBook Pro" until the alias is cleared

#### Scenario: Profile row
- **WHEN** the profile "Personal" uses `~/.claude` and alias `personal`
- **THEN** its row shows the Claude Code badge, "Personal" and `Claude Code · ~/.claude · alias personal`, and tapping it opens the details with the notifications toggle

#### Scenario: OpenRouter profile details
- **WHEN** the profile "Work" has provider OpenRouter with a stored key and $42.10 of credits left
- **THEN** its row shows the `via OpenRouter` chip and its details list the provider, the default model and `$42.10 left`

#### Scenario: Muted summary
- **WHEN** one profile and two sessions are muted
- **THEN** the Muted row reads "1 profile · 2 sessions" and its sheet lists them

#### Scenario: Update the computer
- **WHEN** the daemon reports 0.13.0 available on `main` and the user confirms "Update the computer"
- **THEN** the card shows fetching, building and restarting, reconnects and shows 0.13.0

#### Scenario: Turn off auto-open
- **WHEN** the user turns off "Open the session after creating it"
- **THEN** the choice is kept on this device across restarts, and the next successful `Start session` returns to the session list instead of opening the new session

#### Scenario: Open Permissions
- **WHEN** the user taps the Permissions entry
- **THEN** the Permissions screen opens, showing the "On this phone" and "On this computer" sections

#### Scenario: Return key sends
- **WHEN** the user turns on "Return key sends"
- **THEN** the choice is kept on this device across restarts, and the composer's on-screen return key sends

#### Scenario: Pick a language in Settings
- **WHEN** the user taps `Español` in the Language card
- **THEN** the Settings screen, its header and every other open screen switch to Spanish at once, and the choice is kept across restarts
