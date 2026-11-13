## Why

On iPad (wide layout, inspector → Terminal tab), an ended session shows the daemon's error in red and in English while the app is in pt-BR ("session without a terminal"), and the key bar below it (esc, ^C, arrows, digits) stays enabled though no key can reach the session (#545). The iPhone's Terminal screen of an ended session does the same.

Cause: `TerminalScreen` (`features/terminal/TerminalScreen.tsx`, used by the inspector and by the session's Terminal screen) sends `pane.subscribe` whatever the session's state and, when that fails, shows `errorMessage(e, t)`. `errorMessage` (`core/connection/error-message.ts`) translates only `disconnected`, `timeout`, `invalid_cwd` and `not_found`; for any other code it returns the daemon's own message, in English. A real daemon answers an ended session's `pane.subscribe` with `not_controllable` ("session has no live tmux pane", `requireControllable` in the daemon's input service).

## What Changes

- The terminal of a session that is not controllable sends no `pane.subscribe`. It shows a translated read-only state (no terminal on the computer, the conversation is kept) with the same Resume banner as the conversation, and no key bar. When the session is resumed and becomes controllable, the terminal subscribes and shows the pane.
- `errorMessage` translates every error code of the protocol (`errors.*` in pt-BR, en-US and es-ES), so a known code never shows the daemon's English message; per-call overrides still win. A test walks every code of `ErrorCodeSchema` in the three languages.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `raw-terminal`: "Terminal in the app" adds the read-only state of a session that is not controllable, without subscribing and without the key bar.
- `i18n`: "App language" requires a translated message for every error code of the protocol.

## Impact

- App: `features/terminal/TerminalScreen.tsx`, `core/connection/error-message.ts` (+ test), the three catalogs. No daemon or protocol change.
