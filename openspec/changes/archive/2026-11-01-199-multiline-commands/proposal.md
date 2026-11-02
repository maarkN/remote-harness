## Why

The Run command sheet has a single-line field: Return runs the command, so a sequence copied from a conversation (`cd ~/folder`, `yarn install`, `yarn dev` on separate lines) cannot be typed or pasted as such (#475). The daemon already runs the text with `$SHELL -lc`, so several lines run in order; the change is in the app.

## What Changes

- The command field is multi-line: Return inserts a line break, the Run button (and Command+Return with a hardware keyboard) runs, and a pasted block keeps its lines.
- Several lines run in order and stop at the first failing one: the app sends them under `set -e`; the sheet says so under the field, and refuses a script over the 4,000-character cap.
- The confirmation alert shows every line; the output panel echoes `$ <line>` per line above the output; "Add to prompt" keeps every line in the fenced block.
- Texts in pt-BR, en-US and es-ES; tests for the pure helpers (lines, script, echo, prompt block).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `shell-commands`: "Run command sheet" (multi-line field, Command+Return, lines in order under `set -e`, the echo).

## Impact

- `apps/mobile/src/features/commands/{logic.ts,use-command-run.ts,CommandSheet.tsx}`, the three app catalogs, the web docs; no daemon or protocol change.
