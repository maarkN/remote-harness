## Why

With many sessions the list is hard to scan, and nothing on a row says what a session was last doing without opening it (#93). After the list redesign (#153) profile groups became filter chips, so what remains of the issue is a density setting and a short preview of the last activity, sent by the computer.

## What Changes

- The session gains a `lastActivity` field (`{ kind: 'user' | 'assistant' | 'tool', text, at }`, or `null`): the last prompt, reply or tool call of its transcript, one line of plain text cut to 200 characters. Older daemons omit it (`null`).
- The daemon fills it from the tail of the session's transcript, through the agent's transcript format (no new reader of the `.jsonl`), whenever the session shows activity, at most once every 3 seconds per session; read-only sessions found by the recent scan get it too. Refreshing it does not advance `updatedAt`. It only travels in session messages over the authenticated connection, never in push payloads.
- The app gets a list density setting, remembered on the device: **Compact** (today's row, the default) and **Expanded** (the same row plus the last activity under the folder line: an icon telling prompt, reply or tool, up to two lines of text, and its relative time). It is switched from a chip next to the sort chip and from Settings → Appearance.
- The in-app offline demo fills `lastActivity` from its fixture transcripts.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `session-registry`: new requirement for the session's last activity preview (source, shape, throttle, no `updatedAt` advance, never in push).
- `app-session-list`: new requirement for the Compact / Expanded density and the preview line.

## Impact

- `packages/protocol`: `LastActivitySchema` on `SessionSchema`, the pure extraction (`lastActivityOf`, `previewText`) shared by the daemon and the app's demo.
- `apps/daemon`: a `last-activity` feature (tracker + throttle), a tail reader in the transcript feature, wiring in `main.ts`.
- `apps/mobile`: density store, row preview line, chip, Settings switch, i18n (pt-BR, en-US, es-ES), demo fixtures.
- No new dependencies; push payloads unchanged.
