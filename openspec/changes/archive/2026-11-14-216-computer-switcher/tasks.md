## 1. Filters

- [x] 1.1 Tests first in `features/sessions/filter.test.ts`: `running` and `waiting` state filters list only that state and count as filtering; verify they fail
- [x] 1.2 `StateFilter` gains `running` and `waiting`; `matchesFilter` applies them; verify the tests pass

## 2. Machine line

- [x] 2.1 Pure second-line text (tasks, agents, agents running) in `summary.ts` with a Vitest test (empty → null); verify it passes
- [x] 2.2 `MachineLine`: first line wraps (switcher with a minimum width, name shrinking last), second line for tasks and agents, the running count toggles `running` and the waiting count `waiting`, each highlighted when applied; verify typecheck

## 3. Queries per computer

- [x] 3.1 Pure `computerQueryKey(activeId, key)` with a test, and a `useComputerQueryKey` hook in `core/connection`; verify the test passes
- [x] 3.2 The seven queries (`commands`, `files`, `models`, `provider`, `directories`, `projects`, `checkout`) are keyed by it; verify typecheck and the tests

## 4. Verification

- [x] 4.1 `turbo run typecheck test` (all packages but the Go relay) and Biome green
- [x] 4.2 On the iOS simulator (iPhone SE, pt-BR, Release build, demo with a 38-character computer name, running, waiting, 13 tasks and an agent): the switcher shows dot, full name and chevron on its own line (279 pt wide), the counts wrap below, tasks and agents sit on the next line, nothing overlaps or is cut, and tapping "1 esperando" lists only the waiting session with the count in the accent color; tapping again clears it
- [ ] 4.4 Pending: the same on iPad and in en-US and es-ES
- [ ] 4.3 Pending: the same on Android, and switching between two real computers shows no data of the previous one
