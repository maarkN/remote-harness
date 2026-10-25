## Why

Long conversations feel sluggish and the iPad 9th gen still freezes (#267), and the performance epic (#354) is about to change how the conversation, the session list and the terminal render. Without a fixed scenario and numbers that can be read on a physical device, no PR can show that it made things faster, or that it did not make them slower (#355).

## What Changes

- The demo daemon gets a `--perf` flag that adds three fictional sessions on top of the screenshot ones:
  - a long session with about 5,000 transcript entries (prompts, markdown, code blocks, Read/Edit/Bash tool calls);
  - a bursty session that appends a tool-heavy batch of entries to its transcript every few seconds;
  - a session whose pane prints output continuously, for the raw terminal.
- The app keeps this run's performance numbers on the device, whether or not "Send performance data" is on, and never sends them anywhere by itself:
  - `app_ready` (already traced): time to the first daemon connection;
  - JavaScript stalls (already traced): count, longest and total, now also counted locally;
  - **new** conversation first render: time from opening a conversation to its list drawing its items, with the number of entries;
  - **new** scroll smoothness in a conversation: frames seen, frames dropped and the longest frame while the user scrolls.
- With "Send performance data" on, the two new measurements are also sent as Firebase traces (`conversation_ready`, `conversation_scroll`), numbers only.
- Settings gets a "Performance (this run)" card that shows the numbers and copies them as a Markdown table row, to paste into the before/after table of a PR.
- `CONTRIBUTING.md` explains how to run the scenario on a device and the before/after table that every PR of the epic includes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `performance-monitoring`: local numbers for every run, the conversation render and scroll measurements, the Settings card.
- `demo-mode`: the `--perf` scenario.

## Impact

- `apps/daemon/scripts/` (`demo.mts`, new pure `demo-perf.ts` with tests; `demo-data.ts` exposes the line writer for appends).
- `apps/mobile/src/features/performance/` (pure frame and summary rules with tests, local store, hook changes, card), `features/conversation/ConversationScreen.tsx` (two measurement hooks), `src/app/(main)/settings.tsx`, i18n in pt-BR, en-US and es-ES.
- `CONTRIBUTING.md`.
- No protocol change, no new dependency, no native change.
