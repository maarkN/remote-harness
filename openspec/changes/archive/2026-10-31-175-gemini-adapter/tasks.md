## 1. Protocol

- [x] 1.1 `gemini` agent id; unknown agent ids read as absent on `Profile` and `Session`, with tests

## 2. Transcript

- [x] 2.1 `TranscriptFormat.upserts` and the first-occurrence index in `TranscriptFile` (page, since, live stream), with tests
- [x] 2.2 `gemini-format.ts`: messages → entries, tool name mapping, results, system lines, with fixture tests

## 3. Gemini adapter

- [x] 3.1 Adapter: command, `GEMINI_CLI_HOME` (parent of the `.gemini` folder), resume args, session file discovery, summary (first prompt, `.project_root`), built-in commands, input timing; `configDirEnvValue` / `acceptsConfigDir` in the interface, launcher and `resolveProfiles`
- [x] 3.2 Registered in the adapter table; `gemini` reserved alias

## 4. Hooks and approvals

- [x] 4.1 `gemini-hooks` style: Gemini events → our events in `settings.json`, millisecond timeouts, install/doctor per style
- [x] 4.2 `PermissionDialog` hook event: state `waiting`, no push of its own
- [x] 4.3 Broker `openDialog` + `answerDialog` through the pane (dialog check, `1` / Escape), with tests

## 5. Setup and doctor

- [x] 5.1 Detect `~/.gemini` and suggest a Gemini profile
- [x] 5.2 Doctor: `gemini` on the PATH, Gemini hooks, folder trust note (three languages)

## 6. App

- [x] 6.1 Gemini color, name, code and placeholder icon

## 7. Web and docs

- [x] 7.1 Works with strip, FAQ and trademark notice; daemon and app docs (pt-BR, en-US, es-ES)
- [x] 7.2 CLAUDE.md agent colors

## 8. Verification

- [x] 8.1 Typecheck, tests, Biome, `openspec validate --strict`, `npx expo export --platform ios`; still to try against a real Gemini CLI (hooks in a trusted folder, dialog keys in tmux, paste timing)
