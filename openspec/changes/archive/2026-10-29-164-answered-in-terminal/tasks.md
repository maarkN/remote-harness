## 1. Daemon

- [x] 1.1 `handover.ts`: classify how the session moved on (`result` for a tool result, `turn` for a prompt or a turn hook) and whether that settles an open request (interactive: any; tool permission: `turn` only); tests
- [x] 1.2 Permission watch reports the move kind; the broker settles a still-open request on a qualifying move (empty hook answer, `cancelled`), keeping the handover behavior; broker tests for "moved on while the hook is open" (question, plan, tool permission with a parallel result, tool permission with `Stop`)
- [x] 1.3 `permission.resolved` on the bus says when a tool result settled the request; the sessions feature puts the session back to `running` then; test

## 2. Verify

- [x] 2.1 Typecheck, tests and Biome green
