## 1. Picker script

- [x] 1.1 Tests first in `test/profile-picker.test.ts`. Render the script for three profiles whose launchers are fake: each writes its alias, folder and arguments. Run it with `zsh` and check:
  - `rhnss work --continue` runs `work` without asking.
  - Answering `3` (or `cx`) runs the third profile with all the arguments, in the current folder.
  - `7` asks again, and an empty answer or EOF exits without running a launcher.
  - A single profile starts at once.
  - The rows are aligned, counting a composed accent as one character, and config folders under home show `~`.
  - The texts follow the language passed in.
  - `zsh -n` passes.

  Verify they fail.
- [x] 1.2 `features/hooks/profile-picker.ts`: `renderProfilePicker(profiles, { home, labels })` (pure), with the labels from the i18n catalogs (`install.profilePicker.*` in pt-BR, en-US, es-ES). Verify the tests in 1.1 and the i18n parity tests pass.

## 2. Install, rewrite and removal

- [x] 2.1 `profilePicker` (boolean, default `false`) in `ConfigSchema`. Then in `installer.ts`, `installProfilePicker` writes `rhnss` (0755, atomic) and `uninstallProfilePicker` removes it. `installAll` writes the picker when the setting is on and removes it when off, with an install line either way, and `uninstall` removes it.

  Tests in `test/hooks.test.ts` or `test/setup.test.ts`: the file is written with the current profiles, rewritten when a profile is added, and removed when the setting is off and on `uninstall`.

  Verify they pass.
- [x] 2.2 `rhnss` added to `RESERVED_ALIASES`. Test: `validateAlias('rhnss')` is rejected as reserved. Verify it passes.

## 3. Setup

- [x] 3.1 Wizard: at the end of an interactive run, before the closing summary, ask whether to add `rhnss`, defaulting to the current setting. Save `profilePicker` to `config.json` (read → merge → backup → atomic write), then write or remove the script at once. The closing summary gets a line about `rhnss` when it is on; `--yes` keeps the current setting.

  Test the pure parts (the config merge, the summary lines) and verify they pass.

## 4. Docs and verification

- [x] 4.1 `GLOSSARY.md`: the term **Profile picker**. The daemon docs (`apps/web/content/*/daemon.md`, three languages) get `profilePicker` in the config file section and a paragraph on `rhnss` under the launchers.
- [x] 4.2 `pnpm check` green (typecheck, tests, Biome with warnings as errors). Locally the Go relay is left out, because there is no Go toolchain on this Mac.
- [x] 4.3 On this computer, with a throwaway `HOME` and data folder: `remote-harness install` with `profilePicker: true` writes `rhnss`, and running it lists the profiles and starts the chosen launcher, using fake launchers.
- [ ] 4.4 Pending, on the user's computer: `remote-harness setup`, answer yes to `rhnss`, then `rhnss` in a project folder starts the chosen profile in tmux.
