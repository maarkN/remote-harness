## 1. Setting

- [x] 1.1 Tests first: `ConfigSchema` accepts every `TERMINAL_CHOICES` value and refuses others, and leaves `terminal` absent by default; `effectiveTerminal(choice, platform)` gives `window` on macOS and `auto` elsewhere when absent, and `auto` for `window` / `iterm2` / `terminal` off macOS; `terminalChoicesFor(platform)` lists the choices available there; `withTerminal(raw, choice)` sets it keeping every other key. Verify they fail, implement, verify they pass

## 2. Opening in an external terminal

- [x] 2.1 Tests first in `test/terminal-focus.test.ts`: with a chosen app installed and no client attached, `planShowInTerminal` opens it even when another app runs first in the order; with a client attached, it activates the chosen app when it runs, else the first running one; a chosen app not installed falls back to `auto` and `missingTerminal` names it; `auto`, `window` and absent behave as before; on Linux `ghostty` / `kitty` / `alacritty` / `wezterm` replace `$TERMINAL` with their own arguments, and a missing one falls back to `$TERMINAL` / `x-terminal-emulator`; WSL is unchanged. Verify they fail, implement, verify they pass
- [x] 2.2 Tests first: `installedTerminalApps` finds the macOS bundles (`/Applications`, `~/Applications`, Terminal.app's system path) and the Linux binaries (`which`); `showInTerminal` takes the choice, uses what is installed, and reports the missing app and the one used. Verify they fail, implement, verify they pass

## 3. Tray

- [x] 3.1 Tests first: the popover row's action is `window:<id>` only when the helper opens terminal windows and the effective choice is `window`, else `focus:<id>`; the Preferences window's General tab has the "Open sessions in" picker with the window (macOS), Automatic and the installed apps (plus the current choice), checked on the effective one, as `terminal:<choice>` ids; the plain menu's Preferences submenu has the same choices; labels translated. Verify they fail, implement, verify they pass
- [x] 3.2 `registerUpdatesFeature` keeps the setting with the others (reloaded by `/admin/updates-reload`), finds the installed apps when the helper is ready and on reload, saves `terminal:<choice>` clicks, reads the setting again on every `focus:` click, and notifies a fallback; `pane.focus` reads the setting and notifies a fallback too; verify the typecheck and tests pass

## 4. Setup and CLI

- [x] 4.1 Tests first: `terminalSetupOptions(platform, installed, env, current)` gives the window (macOS), Automatic and the installed apps, marks the one in `$TERM_PROGRAM` / `$TERM`, and preselects the current setting, else the window on macOS, else that terminal when installed, else Automatic. Verify they fail, implement, verify they pass
- [x] 4.2 The wizard asks on its last step (interactive only) and saves a changed answer (backup, atomic write); `remote-harness terminal [choice]` prints or saves (refusing unknown or unavailable choices, warning when not installed) and posts `/admin/updates-reload`. Verify by running `remote-harness terminal`, `terminal kitty`, `terminal foo` and `terminal iterm2` with a temporary `REMOTE_HARNESS_HOME`, and the setup question by its test
- [x] 4.3 The i18n catalogs: choice labels, "(this terminal)", the setup question, the Preferences label, the CLI texts and the fallback notification in pt-BR, en-US and es-ES; verify the parity tests pass

## 5. Verification

- [x] 5.1 On this Mac with a throwaway tmux server: with `ghostty` chosen while iTerm2 runs (or would come first), the steps open Ghostty; with `alacritty` (not installed) the fallback is the first running app and the notification texts name both
- [x] 5.2 `pnpm check` green (typecheck, tests, Biome with warnings as errors); locally without the Go relay, which has no toolchain on this Mac and runs in CI
- [ ] 5.3 Pending, on the user's Mac after `remote-harness update`: setup offers the choice; with Ghostty chosen, a click opens Ghostty even while iTerm2 runs; changing it in Preferences or with `remote-harness terminal` applies to the next click; without the setting, a click opens the terminal window
