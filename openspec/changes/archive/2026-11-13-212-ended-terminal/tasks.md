## 1. Error messages

- [x] 1.1 Test first: for every code of `ErrorCodeSchema`, in pt-BR, en-US and es-ES, `errorMessage` returns a translated text, not the daemon's message, and a per-call override still wins; verify it fails for `not_controllable`
- [x] 1.2 `errors.*` for every code in the three catalogs and a code → key table in `errorMessage`; verify the test and the i18n parity tests pass (the prompt error test expected the raw `internal` message and now expects the translated one)

## 2. Terminal

- [x] 2.1 `TerminalScreen`: no `pane.subscribe` while the session is not controllable; read-only state (`terminal.readOnly.*`) with the Resume banner and no key bar; subscribes once controllable again; verify typecheck, Biome and the React Compiler report

## 3. Verification

- [x] 3.1 `pnpm check` green
- [x] 3.2 On the iOS simulator: the iPhone's Terminal screen (pt-BR) and the iPad inspector in landscape (en-US) of an ended demo session show the read-only state with Resume and no key bar (release build, iOS 26.5)
