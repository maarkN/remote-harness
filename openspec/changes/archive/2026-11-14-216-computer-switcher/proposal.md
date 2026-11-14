## Why

After switching to another computer, the switcher in the Sessions header was squeezed to its dot: a stray chevron overlapped "52 sessions" and the stats row was cut at the right edge ("2 agents · 1 runnin…") (#555, iPhone screenshot). Read in `MachineLine.tsx`: the switcher (dot, name, chevron) is the first part of one row and the only part allowed to shrink (`flexShrink: 1` on it and on the name), while every count keeps React Native's default `flexShrink: 0` and the row cannot wrap. With running, waiting, tasks and agents counts and a longer name (after the handshake the name falls back to `hello.host`), the counts take the whole width and the switcher is drawn at almost nothing, under the counts, and is very hard to tap.

Two more problems found while reading the switch:

- Tapping the running count or the waiting count calls the same `onToggleState('active')`, so the two counts lead to the same filter.
- TanStack Query keys do not include the computer (`['models', profileId]`, `['provider', profileId]`, `['projects', profileId]`, `['checkout', …]`, `['directories', …]`, `['commands', sessionId]`, `['files', …]`) and the query client (`staleTime: 10_000`) is not cleared on a switch, so the previous computer's models, projects, folders or suggestions can show for a few seconds on the new one.

## What Changes

- The machine line becomes two lines, as the issue's comment asks: next to the switcher only "via relay", the session count and the running and waiting counts; background tasks and agents move to a line below. The switcher keeps a minimum width and is never drawn under another part; the first line wraps its counts to a new line instead of squeezing it, and the name is cut with an ellipsis only when it alone is wider than the line.
- Tapping the running count filters the list to running sessions, and the waiting count to waiting ones (new `running` and `waiting` state filters, toggled off by tapping again); the Active and Ended chips stay as they are.
- Every query whose data comes from the computer is keyed by the active computer, so nothing from the previous computer shows after a switch.
- Vitest: the new filters, the second-line text, the computer query key.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-session-list`: "Header and machine line" (two lines, switcher width, the counts' own filters); "Flat list with filter chips" (the `running` and `waiting` filters from the counts).
- `app-computers`: "Computer switcher" (no data of the previous computer after a switch).

## Impact

- App: `features/sessions/components/MachineLine.tsx`, `features/sessions/filter.ts`, `features/sessions/summary.ts`, a computer query-key helper in `core/connection`, the seven queries' keys, tests.
- No protocol or daemon change.
