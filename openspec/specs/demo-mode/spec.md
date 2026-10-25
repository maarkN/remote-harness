# demo-mode Specification

## Purpose
Runs the real daemon in a throwaway sandbox full of fictional sessions, for screenshots, demos and the reproducible load of the performance numbers, without touching the user's own config, tmux or agents.

## Requirements

### Requirement: Demo sandbox
`pnpm --filter @remote-harness/daemon demo` SHALL run the real daemon in a throwaway environment filled with fictional data, for screenshots and demos. It SHALL use its own data home, a file token store, its own tmux server (no `TMUX`, its own `TMUX_TMPDIR`), development mode on `127.0.0.1`, ports other than the defaults, push off, and `HOME` pointing at the demo root, so it never reads or changes the user's real config, token, tmux sessions or Claude Code folders. On macOS the root SHALL default to `/Users/Shared`, so the app shows the demo paths under `~`; `--root <dir>` SHALL choose another one.

It SHALL create, and list in a manifest: profiles "Personal" (`~/.claude`), "Work" (`~/.claude-work`), an OpenRouter profile with a default model and a Codex profile; git repositories under `~/code` with branches, and worktree folders under `<repo>/.claude/worktrees/`; Claude Code sessions in tmux panes registered through the hooks, with transcripts, titles and status lines. At least one session SHALL wait on a permission request (kept pending while the demo runs), one SHALL be running, others idle, and one ended (read-only). Every name, path, prompt and output MUST be fictional.

It SHALL print a `remoteharness://pair?host=127.0.0.1&port=<port>&token=<token>` link. It MUST refuse to start when a path it would create already exists and is not in its manifest. On exit (Ctrl+C) and with `--clean` it SHALL stop the daemon and its tmux server and remove only the paths in the manifest.

#### Scenario: Start the demo
- **WHEN** the developer runs `pnpm --filter @remote-harness/daemon demo` and opens the printed link on a simulator
- **THEN** the app pairs with the demo daemon and lists the fictional sessions, one of them waiting for a permission

#### Scenario: Real data untouched
- **WHEN** the demo runs while the user's own daemon and tmux sessions are running
- **THEN** neither the app paired with the demo nor the demo's tmux server sees them, and the user's config and token are unchanged

#### Scenario: Existing folder
- **WHEN** `/Users/Shared/code` already exists and was not created by the demo
- **THEN** the demo exits with an error naming the folder and creates nothing

#### Scenario: Clean up
- **WHEN** the developer stops the demo with Ctrl+C
- **THEN** the daemon and the demo tmux server stop and every path the demo created is removed

### Requirement: Host name override
The daemon SHALL report `REMOTE_HARNESS_HOST_NAME`, when set and not empty, as the computer's name in `hello`, instead of the system host name.

#### Scenario: Demo machine
- **WHEN** the daemon runs with `REMOTE_HARNESS_HOST_NAME=studio`
- **THEN** the app names the machine "studio"

### Requirement: Performance scenario
`pnpm --filter @remote-harness/daemon demo --perf` SHALL run the demo sandbox with three more fictional sessions, listed in the same manifest and cleaned up the same way:
- a long session, idle, whose transcript has about 5,000 entries mixing prompts, markdown with code blocks, and Read, Edit and Bash tool calls with their results;
- a bursty session, running, to whose transcript the demo appends a batch of about 25 tool-heavy entries every 3 seconds while it runs;
- a session, running, whose pane prints new output several times per second.

The generated content MUST be deterministic and fictional, and every line MUST be a transcript line the daemon parses. Without `--perf` the demo SHALL be unchanged. With `--host <address>` (with or without `--perf`) the demo daemon SHALL accept the app on that address instead of `127.0.0.1` and print it in the pair link, so a physical device can pair; the hooks stay on `127.0.0.1`.

#### Scenario: Run the scenario
- **WHEN** the developer runs the demo with `--perf` and pairs a device
- **THEN** the session list shows the screenshot sessions plus the long, bursty and terminal sessions, the bursty one grows every few seconds and the terminal one keeps printing

#### Scenario: Physical device
- **WHEN** the developer runs the demo with `--perf --host 192.168.1.20`
- **THEN** the printed pair link uses `192.168.1.20` and a phone on that network pairs with the demo

#### Scenario: Screenshots unchanged
- **WHEN** the developer runs the demo without `--perf`
- **THEN** only the screenshot sessions are created
