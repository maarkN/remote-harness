## 1. Decision and vocabulary

- [x] 1.1 ADR `docs/adr/0007-profiles-may-link-to-the-main-profile.md` and **Profile** in `GLOSSARY.md`; verify both read as the repo's others (status, one decision, rejected alternatives)

## 2. Copy

- [x] 2.1 Tests first in `apps/daemon/test/profile-copy.test.ts`, with a temp `~/.claude`, `~/.claude.json` and target: every item copied; credentials, `oauthAccount`, history and `projects/` left out; our hooks and status line stripped; existing settings keys, MCP servers, files and folder entries kept, with a backup of a merged file; link mode (folder symlink when missing, per-entry links when present); a second run writes nothing; nothing checked → nothing written; verify they fail
- [x] 2.2 `features/setup/profile-copy.ts`: pure `mergeSettings` / `mergeMcpServers` and `copyMainProfile(main, target, choice)` returning per-item outcomes (copied, linked, kept, missing); verify the tests of 2.1 pass (including a relative skill link, which a verbatim copy breaks: 75 of the 105 entries in `~/.claude/skills` on this computer are `../../.agents/skills/…` links)

## 3. Wizard

- [x] 3.1 The checklist in `createAccount` (before the login) and `createProviderProfile`, only when `~/.claude` exists and the folder is another one; prints the outcomes; texts in the three CLI catalogs (`setup.copyMain`); verify the i18n parity test and typecheck
- [x] 3.2 On this computer, the copy into a temp folder from the real `~/.claude`: `loadCommands` lists the copied skills under Profile and no credentials or history were copied; verify by listing the folder (134 profile items, the same as `~/.claude`, copied and linked)

## 4. Docs

- [x] 4.1 `getting-started.md` (setup bullets) and `daemon.md` (Profiles) in en-US, pt-BR and es-ES: what the copy brings, what it never does, linking; verify the web docs tests pass

## 5. Verification

- [x] 5.1 `turbo run typecheck test` (all packages but the Go relay) and Biome green
- [ ] 5.2 Pending: run `remote-harness setup` → Create a new account `claude-work` with the copy, log in, and check a session of it on the computer and from the app (skills under Profile, MCP servers in `/mcp`)
