## Why

Installing Remote Harness needs the command line (#620): the install command from remoteharness.app, then `remote-harness setup` in a terminal. On a clean Mac it also needs the Xcode command-line tools. The daemon compiles two programs on the computer: the tray helper (`swiftc`) and the launcher of the LaunchAgent's app bundle (`cc`). And it needs Homebrew for `tmux` and `ripgrep`. That rules out people who would follow their sessions from the phone but never open a terminal to install anything.

This change is the design only: what the installers ship, how they are built, signed and updated, and how setup starts without typing a command. Building each installer is tracked in follow-up issues, one per system plus the shared release pipeline.

## What Changes

- **Release artifacts built in CI**: a per-system *runtime bundle* containing:
  - Node 24;
  - the built daemon with its production dependencies (all pure JavaScript);
  - the prebuilt, signed helpers;
  - on macOS, `tmux` and `ripgrep`.

  Published with checksums and a signature for every release on both channels.
- **macOS**: a signed and notarized `.dmg` with `Remote Harness.app`, needing neither the Xcode command-line tools nor Homebrew. Opening the app for the first time:
  1. installs the runtime bundle under `~/.remote-harness/runtime`;
  2. writes the `remote-harness` shortcut;
  3. opens a terminal already running `remote-harness setup`, the existing wizard (decided: no new first-run window).
- **Linux**: a `.deb` that pulls `tmux`, `zsh`, `ripgrep` and the tray's dependencies from the distribution and adds a "Remote Harness setup" launcher in the applications menu that opens a terminal with `remote-harness setup`. Other formats are left to follow-ups.
- **Windows**: an installer that checks WSL and offers to install it, installs Remote Harness inside the distribution from the Linux runtime bundle and opens Windows Terminal with `remote-harness setup`. The tray stays as ADR-0005 describes.
- **Updates for packaged installs**: `remote-harness update` and automatic updates download the runtime bundle of the new release for the install's channel, verify it, switch to it and restart the service. Installs made with `install.sh` keep today's git-based update.
- **Site**: download buttons on the install page, picked by the visitor's system like the install command, next to the command.
- Considered and not chosen:
  - Rewriting the tray in Flutter. The helpers only draw the menu the daemon sends; Flutter would add a Dart toolchain and a desktop build per system for no gain to the installer.
  - A native first-run window. The terminal running the existing wizard was decided instead.

## Capabilities

### New Capabilities

- `desktop-installers`: covers the download-and-run installers per system, the runtime bundle and its releases, first-run setup in a terminal, updates of packaged installs and the download buttons.

### Modified Capabilities

_None yet._ The follow-up that builds the shared pipeline will modify `guided-installer` ("Update command": two install kinds) and `daemon-service` (the LaunchAgent runs the signed app's launcher instead of an ad-hoc bundle built on the computer).

## Impact

- New CI workflows to build, sign, notarize and publish the release artifacts, with secrets:
  - the Apple Developer ID certificates and an App Store Connect API key for notarization;
  - a Windows code-signing certificate;
  - the release signing key.
- Daemon:
  - an install record (`install.json`: `source` or `package`, the runtime version);
  - `update` learns the package kind;
  - the tray helper and the LaunchAgent launcher are taken prebuilt from the runtime bundle when present, and still compiled from source otherwise.
- Site: download buttons and links to the release assets.
- No protocol or app change.
