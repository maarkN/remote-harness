## Why

Each profile gets its own launcher (`~/.remote-harness/bin/<alias>`), so starting a session means remembering which alias opens which account (#617). With several profiles (work, personal, a client's Codex) there is no single entry point. A user who opts in should be able to type one command in any folder, pick the profile from a numbered list and get exactly what that profile's launcher does.

## What Changes

- A new **profile picker**, the `rhnss` command, written next to the launchers in `~/.remote-harness/bin` when `profilePicker` is `true` in `config.json`. The default is `false`.
- `rhnss` lists the profiles as numbered rows of agent · name · config folder, in aligned columns, asks for a number and then `exec`s that profile's launcher with all the arguments it got. So `rhnss --resume <id>` behaves like `<alias> --resume <id>`, in the current folder.
  - `rhnss <alias> [args…]` starts that profile without asking.
  - With a single profile, `rhnss` starts it directly.
  - An answer out of range asks again; the profile's alias is accepted as an answer too. Ctrl+D or an empty answer cancels without starting anything.
- The list and the texts are baked into the script when it is written, in the language of `config.json`. `install`, `setup` and `update` rewrite it together with the launchers, so profiles added, renamed or removed show up without editing anything by hand. With `profilePicker` off, those commands remove a picker left from before, and `uninstall` removes it too.
- At the end of `remote-harness setup` (interactive), before the closing summary, the wizard asks whether to add the `rhnss` command. The default is the current setting. The answer is saved to `config.json` and the script is written or removed at once. The closing summary mentions `rhnss` when it is on.
- `rhnss` becomes a reserved alias, so no profile can take its name.
- Labels in pt-BR, en-US and es-ES. Tests cover the generated script: the direct start, the numbered choice, the arguments passed through, a single profile, an invalid answer and the alignment. They also cover the install, rewrite and removal, and the reserved alias.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `launchers`: new requirement "Profile picker" (the `rhnss` command, how it is written, rewritten and removed).
- `guided-installer`: "Profile wizard" asks at the end whether to add the profile picker, and the alias `rhnss` is reserved.

## Impact

- Daemon:
  - `features/hooks/profile-picker.ts` (new): the pure script renderer.
  - `features/hooks/installer.ts`: write and remove the picker.
  - `features/setup/install.ts`: `installAll` writes or removes it.
  - `features/setup/wizard.ts`: the question at the end and the summary line.
  - `features/setup/profiles.ts`: the reserved alias.
  - `core/config.ts`: `profilePicker`.
  - `cli.ts`: `uninstall`.
  - The i18n catalogs.
- `GLOSSARY.md`: the term **Profile picker**.
- No protocol or app change. Existing installs keep `profilePicker` off until the user opts in through `setup`.
