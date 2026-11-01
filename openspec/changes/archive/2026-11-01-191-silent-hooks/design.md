## Context

`buildHookEntry` writes `type: 'http'` entries for every Claude Code event but `SessionStart` (a command hook, since Claude Code runs only command hooks there). Codex, Qwen Code (`buildCodexHookEntry`), Gemini CLI (`buildGeminiHookEntry`) and Kimi CLI (`postCommand`) already get command hooks that swallow their output and exit 0, and their `PermissionRequest` hook prints the daemon's answer on stdout, which the agent reads as the decision. The daemon answers a `PermissionRequest` with `hookSpecificOutput` JSON and detects a dropped request through the closed connection. See proposal.md for the motivation.

## Goals / Non-Goals

- Goals: no hook error in a Claude Code session while the daemon is stopped; identical behaviour with the daemon running; the migration of existing `settings.json` files without a new step.
- Non-goals: changing what the daemon does with the events; the Codex, Gemini CLI, Kimi CLI and Qwen Code hooks (already silent); the `SessionStart` hook (already a command).

## Decisions

- **One `buildHookEntry` for Claude Code, Codex and Qwen Code**: the Codex builder already did exactly what Claude Code needs (silenced posts, a permission hook that prints the answer, `SessionEnd` within 3 s), so it becomes the shared builder and `buildCodexHookEntry` goes away; Gemini CLI keeps its builder (timeouts in milliseconds). Claude Code's `PermissionRequest` command hook returns the decision the same way the `http` hook did: the JSON on stdout is the documented command-hook form, and a killed curl (the user answered in the terminal) closes the connection, which the daemon already treats as an abandoned request, as it does for Codex today.
- **`-m` on curl plus a 10 s longer hook `timeout`**, as Codex: when the daemon never answers, curl exits first with an empty stdout and Claude Code falls back to its prompt; a hook killed by its own timeout would be reported as a failure instead.
- **`secret` leaves `HookInstallOptions`**: it was only written into the `http` entries' headers; every command reads the curl config. The installer still rotates a secret that has no curl config (unchanged).
- **Migration by the existing remover**: `isOurHook` keeps matching `http` entries whose URL is ours, so `mergeOurHooks` (run by `install`, `setup` and the install after `update`) drops them and writes the command hooks; `hasOurHooks` (doctor) accepts either form, so a doctor on an old install still says the hooks are there (they are, just noisy) until the next install.

## Risks / Trade-offs

- [A command hook spawns a shell and curl per event, the `http` hook did not] → the same cost every other agent's hooks already pay; the events are a handful per turn.
- [Claude Code parses a command hook's stdout strictly] → the daemon prints exactly the JSON body it returned to the `http` hook; the test runs the generated command against the real hooks server.
- [Users on old installs keep seeing the error until they reinstall] → `remote-harness update` reinstalls; the release notes say so.
