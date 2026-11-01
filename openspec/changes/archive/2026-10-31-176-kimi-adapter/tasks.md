## 1. Transcript

- [x] 1.1 `kimi-format.ts`: wire lines → entries, tool name mapping, results, interruptions, compactions, images, with fixture tests

## 2. Kimi adapter

- [x] 2.1 Adapter: command, `KIMI_SHARE_DIR`, `--session`, session discovery, summary (`state.json`, `kimi.json`, first prompt), built-in commands, input timing, transcript path from data dir + cwd + id
- [x] 2.2 Hook receiver fills a missing `transcript_path` from the adapter; adapter registered; `kimi` reserved alias

## 3. Hooks

- [x] 3.1 `kimi-hooks.ts`: `[[hooks]]` tables merged/removed by command, every other line kept, inline `hooks` key refused, with tests
- [x] 3.2 Installer and doctor for the `kimi-toml` style

## 4. Approvals

- [x] 4.1 `ApprovalDialog.detect` / `identify`; Kimi panel detector and keys (`1` / `3`)
- [x] 4.2 Screen watcher in the permissions feature (open on panel, resolve when gone or replaced, identity check before typing); `openDialog` resolves an older open dialog request, with tests

## 5. Setup and doctor

- [x] 5.1 Detect `~/.kimi` and suggest a Kimi profile; doctor checks and messages (three languages)

## 6. Web and docs

- [x] 6.1 Works with strip, FAQ, docs (pt-BR, en-US, es-ES) and README

## 7. Verification

- [x] 7.1 Typecheck, tests, Biome, `openspec validate --strict`; still to try against a real Kimi CLI (hooks, panel text in tmux, ToolCall written before the panel)
