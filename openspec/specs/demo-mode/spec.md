# demo-mode Specification

## Purpose
Fictional demos of the product: the real daemon in a throwaway sandbox full of fictional sessions, for screenshots, demos and the reproducible load of the performance numbers, without touching the user's own config, tmux or agents; and an offline demo inside the app, from the same fictional data, for store review and anyone without a computer set up.

## Requirements

### Requirement: Demo sandbox
`pnpm --filter @remote-harness/daemon demo` SHALL run the real daemon in a throwaway environment filled with fictional data, for screenshots and demos. It SHALL use its own data home, a file token store, its own tmux server (no `TMUX`, its own `TMUX_TMPDIR`), development mode on `127.0.0.1`, ports other than the defaults, push off, and `HOME` pointing at the demo root, so it never reads or changes the user's real config, token, tmux sessions or Claude Code folders. On macOS the root SHALL default to `/Users/Shared`, so the app shows the demo paths under `~`; `--root <dir>` SHALL choose another one.

It SHALL create, and list in a manifest: profiles "Personal" (`~/.claude`), "Work" (`~/.claude-work`), an OpenRouter profile with a default model and a Codex profile; git repositories under `~/code` with branches, and worktree folders under `<repo>/.claude/worktrees/`; Claude Code sessions in tmux panes registered through the hooks, with transcripts, titles and status lines. At least one session SHALL wait on a permission request (kept pending while the demo runs), one SHALL be running, others idle, and one ended (read-only). Every name, path, prompt and output MUST be fictional.

It SHALL print a `remoteharness://pair?host=127.0.0.1&port=<port>&token=<token>` link. It MUST refuse to start when a path it would create already exists and is not in its manifest. On exit (Ctrl+C or SIGTERM) and with `--clean` it SHALL stop the daemon and its tmux server and remove only the paths in the manifest, and on exit it MUST wait until the daemon process itself has exited (after writing its state) before removing anything. `--clean` SHALL also remove the demo's data home (`<root>/.remote-harness-demo`), which only the demo uses, when an earlier run left it without a manifest; a start refused only because of that folder SHALL suggest `--clean`.

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

#### Scenario: Nothing left after stopping
- **WHEN** the developer stops the demo, with or without `--perf`, by Ctrl+C or SIGTERM
- **THEN** the demo root has nothing the demo created, `.remote-harness-demo/state.json` included

#### Scenario: Leftover from an older run
- **WHEN** `<root>/.remote-harness-demo` was left by an older demo without a manifest
- **THEN** starting the demo refuses and suggests `--clean`, and `--clean` removes the folder

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

### Requirement: In-app offline demo
The app SHALL offer an offline demo that needs no computer: a fictional computer that lives only in the app's memory, reached through the app's normal connection code with an in-memory socket instead of the network. The demo daemon SHALL answer the WebSocket protocol with messages that pass the same `@remote-harness/protocol` validation as a real daemon's, after a Noise handshake with keys generated for that run only. The demo MUST NOT open any network connection for its data, MUST NOT save its computer or keys, and MUST NOT change the paired computers.

Every main screen SHALL work in the demo with fictional data: the session list with sessions waiting for a permission, running, idle and ended (read-only); a conversation with thinking, text, tool calls and their results; answering the waiting permission request (allowing or denying it moves the session on with a fictional result); the raw terminal with the agent's prompt box and its mode line, which follows mode changes made in the app; subagents with their own transcripts; the session's changes and diffs; Settings (machine, paired devices, profiles, rules, approval log, computer permissions, daemon update). A prompt sent in the demo SHALL appear in the conversation and get a short fictional reply. A request the demo does not simulate (for example starting or resuming a session, attachments, shell commands, commit and push, adding a device) SHALL fail with a localized "not available in the demo" message instead of hanging.

#### Scenario: Open the demo
- **WHEN** the user taps **Try the demo** on the pairing screen with the phone in airplane mode
- **THEN** the session list shows the fictional sessions, one of them waiting for a permission

#### Scenario: Approve in the demo
- **WHEN** the user allows the waiting request in the demo
- **THEN** the request disappears, the session shows the tool's fictional result and becomes idle

#### Scenario: Terminal mode line
- **WHEN** the user switches a demo session to plan mode and opens its terminal
- **THEN** the terminal shows the plan mode line

#### Scenario: Unsupported action
- **WHEN** the user tries to start a new session in the demo
- **THEN** the app says that it is not available in the demo

### Requirement: Demo banner and exit
While the demo runs, the session list, the conversation and the terminal SHALL show a banner saying it is a demo, with an action to leave it, and Settings SHALL show a Demo card with the same action in place of the Computers card, without the Machine card's Forget and rename actions. Leaving SHALL close the demo connection and return to the pairing screen, and MUST clear every piece of demo state the app holds: its sessions, transcripts, pending requests, drafts, pinned and hidden sessions. Leaving MUST NOT remove or change any paired computer. Pairing a real computer while in the demo SHALL end the demo the same way. The demo SHALL not survive an app restart: the app starts on the pairing screen again.

#### Scenario: Leave the demo
- **WHEN** the user taps **Leave demo** on the banner
- **THEN** the pairing screen appears, and opening the demo again shows its initial state without the drafts typed before

#### Scenario: Restart during the demo
- **WHEN** the app is killed while in the demo and opened again
- **THEN** the pairing screen appears

### Requirement: Demo stays off the services
While the demo runs, the app MUST NOT register for push (no notification permission prompt, no token sent), MUST NOT start or register Live Activities or the Android live status, MUST NOT send error reports, and MUST NOT send performance data, whatever the user's settings say; the Settings cards for notifications, error reports and performance numbers SHALL be hidden. The user's own settings SHALL be the same after leaving the demo.

#### Scenario: Push stays off
- **WHEN** the user opens the demo on a fresh install
- **THEN** no notification permission prompt appears and no push token is requested

#### Scenario: Performance data on
- **WHEN** "Send performance data" is on and the user opens the demo
- **THEN** no trace is sent while the demo runs, and the setting is still on after leaving

### Requirement: Shared demo fixtures
The fictional profiles, repositories, sessions (with their transcripts, permission request, status lines, subagents) and the terminal text of each session SHALL be defined once, in a module without Node APIs that both the daemon's screenshot demo and the in-app demo read, so screenshots and the in-app demo show the same data. Every name, path, host, prompt and output in it MUST be fictional.

#### Scenario: Same sessions
- **WHEN** the developer runs the daemon demo and also opens the in-app demo
- **THEN** both list the same sessions with the same titles and states
