## Why

Settings is one scrolling page of fifteen cards, several of them tall, so finding one option means scanning all of them (#493). The OS settings apps solve this with a short list of sections, each opening its own screen.

## What Changes

- The Settings route becomes a list of nine sections that fits on one screen of a regular phone: Computer, Devices, Appearance, Profiles, Sessions, Notifications, Permissions, Voice and App. Each row has an icon, the title, one line with the section's current state ("Dark · Match theme", "Push on · Live status off · 2 muted") and a chevron; the app version stays under the list.
- Each section is its own stack screen with the existing cards: Computer (Machine, Computers, Computer update; the Demo card in the demo), Devices, Appearance (theme and density, app icon), Profiles, Sessions (New session, Prompt templates, Keyboard), Notifications, Voice and App (updates and channel, language, error reports, performance numbers). Permissions keeps opening the Permissions screen directly.
- The row summaries come from a pure helper with tests; the demo keeps hiding Computers and Notifications and shows the Demo card in Computer.
- Everything that opened Settings (the header button, ⌘,, the `remoteharness://settings` link) opens the sections list; the sub-screens (Permissions, Rules, Activity, Prompt templates) are unchanged.
- A sibling prototype `settings-sections` (the list and one section) joins `docs/design/identity/screens/`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-shell`: "Settings screen" (the sections list, the section screens and their summaries).

## Impact

- App only: `features/settings/{SettingsScreen.tsx,SettingsSections.tsx,sections.ts,sections.test.ts}`, routes `src/app/(main)/settings/{index,computer,devices,appearance,profiles,sessions,notifications,voice,app}.tsx` (replacing `settings.tsx`), the main layout's screen titles, `PermissionsCard` removed (its row lives in the list); i18n in pt-BR, en-US and es-ES; `docs/design/identity/screens/settings-sections.{html,png}` and `manifest.tsv`.
- No protocol, daemon or native change (ships over the air).
