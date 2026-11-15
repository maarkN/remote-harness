## 1. Daemon

- [x] 1.1 Tests first in `apps/daemon/test/autocomplete.test.ts`: profile, project and plugin layouts with nested skill folders, a symlinked skill folder, a symlinked command file and folder, a broken link and a link loop; verify they fail on the current loader for the symlinks only
- [x] 1.2 `features/autocomplete/commands.ts` follows symlinks (stat the target; skip broken links; keep the depth bound for skills and add one for commands); verify the tests of 1.1 pass and `loadCommands('~/.claude', …)` on the computer lists the symlinked skills (`code-review`)
- [x] 1.3 Input test in `apps/daemon/test/input.test.ts`: `/review-pr 42` is pasted as is and followed by Enter only (paste strategy); verify it passes

## 2. App

- [x] 2.1 The `/` list's Profile header names the session's profile folder (`autocomplete.section.profileAt` in the three catalogs, pure title helper with a Vitest test); verify the test and the i18n parity tests pass

## 3. Docs

- [x] 3.1 `using-the-app.md` (en-US, pt-BR, es-ES), Sending prompts: where `/` commands come from per agent; verify the web docs tests pass

## 4. Verification

- [x] 4.1 `pnpm check` green
