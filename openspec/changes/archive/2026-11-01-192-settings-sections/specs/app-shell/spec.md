## MODIFIED Requirements

### Requirement: Settings screen
The Settings route SHALL be a list of sections that fits on one screen of a regular phone without scrolling, in this order: **Computer**, **Devices**, **Appearance**, **Profiles**, **Sessions**, **Notifications**, **Permissions**, **Voice** and **App**. Each row SHALL show an icon, the section's title, one line with its current state and a chevron, and the app version SHALL stay under the list. Tapping a row SHALL open the section's own screen, titled after the section and with the usual back navigation, holding the cards that belong to it; the Permissions row SHALL open the Permissions screen directly (which lists every system permission the app and the computer rely on, its status, why it's needed, and how to fix it).

The sections SHALL hold: **Computer** — Machine (the connection pill; the machine name, the alias when set else the daemon's hostname, with an Edit action that saves or clears the alias; one line `host:port · remote-harness <daemon version> · protocol <n>` leaving unknown parts out; `Forget this machine`), Computers (every paired computer: switch, rename, forget, add another) and Computer update (the daemon version and update channel with a `main` / `development` selector, `Check for updates`, the available version, `Update the computer` after a confirmation that warns about a downgrade and about busy sessions, the run progress and its outcome; for a daemon without remote updates, the `remote-harness update` command); **Devices** — the phones and tablets paired with the computer, Add device and revoke; **Appearance** — a Theme row naming the resolved theme that opens the theme picker modal, the session list density, and an App icon row naming the current choice that opens the icon picker modal (Match theme, Original, and one per theme; see "App icon follows the theme"); **Profiles** — one row per profile with the agent badge, the name in the profile color, the dashed `via <provider>` chip when the profile has a provider, and `<agent> · <config dir> · alias <id>`; tapping opens a details sheet with the agent, the alias, the config dir, the profile's notifications toggle and, for a profile with a provider, the provider, its default model and the credits left, or the hint to run `remote-harness provider key <id>` when no key is stored; **Sessions** — New session (`Open the session after creating it` toggle, on by default, per device), Prompt templates and Keyboard (`Return key sends` toggle, off by default, per device, with the hint that the on-screen keyboard then has no new line; autocorrect in the message input); **Notifications** — `Push notifications` toggle for this phone with the hint "Only this phone · never the conversation", showing the push status and test while on; `Live status` toggle; a `Muted` row with `N profiles · M sessions` that opens a sheet with the per-profile switches and the muted sessions, each unmutable; **Voice** — transcription language, dictation polish and press-and-hold; **App** — version, update and channel, `Check for updates`, `Documentation`, `Report a problem`, the app language, error reports and the performance numbers of this run.

The row summaries SHALL read: Computer `<machine name> · <connection status>`; Devices a fixed hint; Appearance `<resolved theme> · <app icon choice>`; Profiles `<N profiles> · <the agents used>`; Sessions the options that are on and the number of templates (a fixed hint when none); Notifications `Push on|off · Live status on|off`, then `N muted` when anything is muted; Permissions its hint; Voice the transcription language; App `<version> · <update channel> · <app language>`. In the offline demo the list SHALL have no Notifications row, Computer SHALL show the Demo card instead of Computers, and App SHALL leave out error reports and performance numbers. The header button of the session list, ⌘, and the `remoteharness://settings` link SHALL open the sections list. All texts MUST be translated.

#### Scenario: Sections list
- **WHEN** the user opens Settings on a phone with the dark theme, the icon matching the theme, two profiles (Claude Code and Codex), push on and nothing muted
- **THEN** the nine rows are visible without scrolling, Appearance reads "Dark · Match theme", Profiles "2 profiles · Claude Code, Codex" and Notifications "Push on · Live status on"

#### Scenario: Open a section
- **WHEN** the user taps Notifications
- **THEN** a screen titled Notifications opens with the push, live status and Muted rows, and Back returns to the list

#### Scenario: Demo mode
- **WHEN** the offline demo is on
- **THEN** the list has no Notifications row, Computer shows the Demo card and no Computers card, and App has no error reports or performance cards

#### Scenario: Rename the machine
- **WHEN** the user taps Edit on the Machine card of the Computer section, types "MacBook Pro" and saves
- **THEN** the card, the Computer row and every `{{machine}}` text show "MacBook Pro" until the alias is cleared

#### Scenario: Profile row
- **WHEN** the profile "Personal" uses `~/.claude` and alias `personal`
- **THEN** its row in the Profiles section shows the Claude Code badge, "Personal" and `Claude Code · ~/.claude · alias personal`, and tapping it opens the details with the notifications toggle

#### Scenario: OpenRouter profile details
- **WHEN** the profile "Work" has provider OpenRouter with a stored key and $42.10 of credits left
- **THEN** its row shows the `via OpenRouter` chip and its details list the provider, the default model and `$42.10 left`

#### Scenario: Muted summary
- **WHEN** one profile and two sessions are muted
- **THEN** the Muted row of the Notifications section reads "1 profile · 2 sessions", its sheet lists them, and the Notifications row of the list ends with "3 muted"

#### Scenario: Update the computer
- **WHEN** the daemon reports 0.13.0 available on `main` and the user confirms "Update the computer" in the Computer section
- **THEN** the card shows fetching, building and restarting, reconnects and shows 0.13.0

#### Scenario: Turn off auto-open
- **WHEN** the user turns off "Open the session after creating it" in the Sessions section
- **THEN** the choice is kept on this device across restarts, and the next successful `Start session` returns to the session list instead of opening the new session

#### Scenario: Open Permissions
- **WHEN** the user taps the Permissions row
- **THEN** the Permissions screen opens, showing the "On this phone" and "On this computer" sections

#### Scenario: Return key sends
- **WHEN** the user turns on "Return key sends" in the Sessions section
- **THEN** the choice is kept on this device across restarts, and the composer's on-screen return key sends

#### Scenario: Pick a language in Settings
- **WHEN** the user taps `Español` in the Language card of the App section
- **THEN** the section, the Settings list, their headers and every other open screen switch to Spanish at once, and the choice is kept across restarts
