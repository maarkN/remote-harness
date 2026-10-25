## ADDED Requirements

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
