## 1. Transcript

- [x] 1.1 `qwen-format.ts`: records → entries (typed prompts only), tool names shared with Gemini CLI, results, compactions, `custom_title` meta, with fixture tests

## 2. Qwen adapter

- [x] 2.1 Adapter: command, `QWEN_HOME`, `--resume`, transcript discovery, summary (cwd, first prompt, latest title), built-in commands, input timing; registered; `qwen` reserved alias

## 3. Hooks and permissions

- [x] 3.1 `qwen-settings` style: Codex-style command entries for Qwen's events, `StopFailure` posted as `Stop`; installer and doctor
- [x] 3.2 Permission requests with Allow / Deny only (bare decision), with tests

## 4. Setup and doctor

- [x] 4.1 Detect `~/.qwen` and suggest a Qwen profile; doctor checks and messages (three languages)

## 5. Web and docs

- [x] 5.1 Works with strip (no "soon" left), FAQ, docs (pt-BR, en-US, es-ES) and README

## 6. Verification

- [x] 6.1 Typecheck, tests, Biome, `openspec validate --strict`; still to try against a real Qwen Code (hooks, permission answer, paste timing)
