## Why

The app's language follows the device locale only (`pt-*` → pt-BR, `es-*` → es-ES, else en-US) and there is no way to override it (#436). Someone with the phone in one language cannot use the app in another, and the first screen an unpaired user sees is the pairing screen, already in a language they did not choose.

## What Changes

- A **language preference** kept on the device: "Same as the phone" (default) or one of pt-BR, en-US, es-ES. It is resolved against the device language like today and applied live: every open screen, header title, sheet and menu re-renders without a restart, and the choice survives a relaunch.
- **First launch**: a language step before the pairing screen, with the three languages and "Same as the phone" preselected; the screen previews each choice as it is tapped and a Continue action saves it and opens pairing. The step is shown only while no computer is paired and no language was ever saved, so existing users never see it.
- **Settings → Language**: a card with the same options, applied at once and persisted.
- Texts that come from the computer (push notifications, CLI hints, setup) keep the daemon's language; the voice transcription language keeps its own setting ("Same as the app" follows the new choice).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `i18n`: "App language" — the device language is the default, overridable by a language preference kept on the device; the first-launch language step.
- `app-shell`: "Authenticated connection" (without credentials, the first launch opens the language step and then the pairing screen) and "Settings screen" (the new **Language** card).

## Impact

- `apps/mobile/src/core/i18n` (preference store and resolver next to the existing device-locale resolver, start-up restore), `apps/mobile/src/app/_layout.tsx` and `(main)/_layout.tsx` (language route, redirect on first launch, restore gating the first render), a `features/language` feature with the first-launch screen and the Settings card, i18n keys in pt-BR, en-US and es-ES, web docs (using the app).
- No protocol or daemon change; no new native dependency (ships over the air).
