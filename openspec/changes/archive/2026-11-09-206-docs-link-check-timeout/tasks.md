## 1. Link check

- [x] 1.1 Split the link check in `apps/web/test/docs.test.ts` into one case per language (`test.each(WEB_LOCALES)`) with an explicit 30 s timeout, building the anchor table once; verify `pnpm --filter @remote-harness/web test` passes and a deliberately broken link (temporary edit of a content page) fails the case of its language naming the page and the link
- [x] 1.2 Review the other `apps/web` tests for a single case that renders every page in every language; verify none remains and note the result in the proposal

## 2. Verification

- [x] 2.1 `pnpm turbo run typecheck test` and Biome (with the worktree-safe `biome.json` tweak) green on the worktree (the daemon files that time out while an Android release build saturates the machine pass in isolation on the same tree)
