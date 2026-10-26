## 1. Protocol

- [x] 1.1 `changes.result` fields (`remote`, `defaultBranch`, `unpushed`, `gh`); `changes.commit`/`committed`, `changes.push`/`pushed`, `changes.pr`/`prOpened`, `changes.generate`/`generated`; samples in the protocol tests

## 2. Daemon

- [x] 2.1 `infra/git.ts`: `commitPaths`, `createBranch`, `remoteUrl`, `defaultBranch`, `unpushed`, `log`/`diffStat` for PR generation; pure `stripCredentials`, `githubCompareUrl`; Vitest (real repository + pure)
- [x] 2.2 `infra/github.ts`: `available()`, `createPr()`; Vitest with a fake executor
- [x] 2.3 Agent adapter one-shot call; voice polish uses it unchanged
- [x] 2.4 `features/changes`: `actionAllowed` gate, commit/push/pr/generate handlers, info fields on the list; Vitest for the gate, partial commit, new branch, push to a local bare remote, PR via fake `gh`, generation via fake CLI

## 3. App

- [x] 3.1 Pure helpers: `branchNameFrom`, `isProtectedBranch`, `actionBlocked`; Vitest
- [x] 3.2 Selection, message field with Generate, Commit / Push / Open PR buttons with the gate and "Do it anyway"
- [x] 3.3 Confirmation sheets (files, branch, remote; new-branch offer; main/master warning; PR title/body; compare link without `gh`)
- [x] 3.4 i18n strings in pt-BR, en-US and es-ES; web docs (using the app) in the three languages

## 4. Verify

- [ ] 4.1 `turbo run typecheck test` and Biome green
- [ ] 4.2 `npx expo export --platform ios` bundles
