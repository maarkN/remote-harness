## Why

The docs link check in `apps/web` (`test/docs.test.ts` → "every internal link and anchor on every page resolves") renders every docs page in the three languages inside one test case. On the macOS CI runner, with `turbo run typecheck test` running every package at once, that one case took 8.2 s and hit vitest's default 5 s timeout, failing the "Typecheck, test & lint" job of PR #530 on a tree that had passed twice minutes earlier (#532). The same timeout reproduces locally under the parallel turbo run. Locally in isolation the case takes about half a second: the failure is time, not a broken link.

## What Changes

- The link check becomes one case per language, each with an explicit timeout that fits its work on a loaded runner (30 s), and the anchor table is built once and shared by the three cases. A broken link or anchor still fails the case of its language, naming the page and the link.
- The other `apps/web` tests are reviewed for a single case that renders every page in every language; none does (`landing`, `install` and `app-link` already run one case per language, the registry test only parses the Markdown).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `web-docs`: "Documentation links and checks" says the link check runs per language with a time budget that covers rendering every page of that language on a loaded CI runner, so it never fails for time alone.

## Impact

- `apps/web/test/docs.test.ts` only. No production code, no protocol, no app change.
