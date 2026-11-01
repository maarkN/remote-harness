## Context

`SettingsScreen` renders every card in one `ScrollView`; the route `settings.tsx` appends the Voice, App updates, Error reports and Performance cards. Each card already owns its state and sheets, and the sub-screens (`permissions`, `permission-rules`, `permission-activity`, `templates`) show the stack pattern. See proposal.md for the motivation.

## Goals / Non-Goals

- Goals: a list that fits one screen with a truthful one-line state per section; section screens that reuse the cards untouched; every existing entry point still lands right.
- Non-goals: redesigning the cards themselves; a search over settings; per-section deep links beyond the existing `remoteharness://settings`.

## Decisions

- **Routes under `settings/`** (`index` plus one file per section) instead of query parameters: each section gets its own stack entry, title and back gesture for free, and `router.push('/settings')` keeps working. Permissions stays at `/permissions`, reached from the list's row (the `PermissionsCard` goes away).
- **Summaries from a pure helper** (`settingsSections(snapshot, t)`): the list component reads the stores (connection, theme, app icon, profiles, open-after-create, return key, templates, push, live status, mute, voice language, update channel, language) and hands a plain snapshot to the helper, which is tested in Vitest in two languages. Summaries reuse the labels the cards already have (`settings.themes.*`, the icon picker rows, `connection.status.*`, `updates.channels.*`, `LOCALE_NAMES`).
- **Devices and Permissions rows get fixed hints**: the devices list is fetched from the daemon by its card, and a count on the list would mean a second request on every visit.
- **Section screens in one module** (`SettingsSections.tsx`) composing the cards, so the route files stay one line and the order of cards per section is in one place.
- **Prototype as a sibling** (`settings-sections.html`): the old `settings.html` documents the cards, which still exist inside the sections.

## Risks / Trade-offs

- [One more tap to reach any option] → the summaries answer the common "what is it set to?" without the tap, and the sections are nine, not fifteen.
- [A summary drifting from a card's real state] → both read the same stores and labels; the helper's tests pin the format.
