## ADDED Requirements

### Requirement: Release runtime bundle
Each release SHALL publish, for macOS (one universal bundle), Linux x64 and Linux arm64, a runtime bundle holding Node 24, the built daemon with its production dependencies and the prebuilt tray helper. On macOS the bundle SHALL also hold the prebuilt LaunchAgent launcher, `tmux` and `ripgrep`, every executable signed with the Developer ID certificate. The release SHALL publish a manifest with each asset's URL and SHA-256, signed with the release key whose public key is built into the daemon. Releases of `main` SHALL be full releases and those of `development` pre-releases.

#### Scenario: A release is published
- **WHEN** version 1.4.0 is released on `main`
- **THEN** the runtime bundles for the three systems, the installers and a signed `main` manifest naming 1.4.0 with every asset's SHA-256 are published

### Requirement: macOS installer
A signed, notarized and stapled `.dmg` SHALL hold `Remote Harness.app`, which embeds the macOS runtime bundle and needs neither the Xcode command-line tools nor Homebrew. When opened for the first time, the app SHALL install the bundle under `~/.remote-harness/runtime`, write the `remote-harness` shortcut and the PATH block, record a `package` install, and open a terminal already running `remote-harness setup`. When opened later, it SHALL install its bundle only when it is newer than the installed one, and start the background service when it is installed but not running. The LaunchAgent SHALL run the runtime's signed launcher, so the privacy grants survive updates.

#### Scenario: Clean Mac
- **WHEN** a Mac without the Xcode command-line tools or Homebrew downloads the `.dmg`, drags the app to Applications and opens it
- **THEN** a terminal opens with the setup wizard running, and once the wizard ends the daemon runs, the tray icon shows and a phone can pair, without a command typed

#### Scenario: Opened again
- **WHEN** the service was stopped from the tray and the user opens the app again
- **THEN** the service starts and the tray icon comes back, without reinstalling or opening the wizard

### Requirement: Linux package
A `.deb` for amd64 and arm64 SHALL depend on `tmux`, `zsh`, `ripgrep` and the tray helper's libraries, embed the Linux runtime bundle and add a "Remote Harness setup" entry to the applications menu. That entry SHALL install the runtime for the user as on macOS and open a terminal (`$TERMINAL`, else `x-terminal-emulator`, else the first common terminal found) running `remote-harness setup`.

#### Scenario: Ubuntu desktop
- **WHEN** the user installs the `.deb` from the Software app and picks "Remote Harness setup" from the applications menu
- **THEN** a terminal opens with the setup wizard running, and once it ends the daemon runs with its tray icon

### Requirement: Windows installer
A signed Windows installer SHALL check for WSL and, when it is missing, offer to install it (asking for admin rights for that step only), resuming after the reboot it needs. Without a Linux distribution it SHALL install Ubuntu. It SHALL install the Linux runtime bundle inside the distribution for the user, with `tmux`, `zsh` and `ripgrep`, and open Windows Terminal (a console window when it is missing) running `remote-harness setup` in that distribution. The tray SHALL work as the "Windows tray" requirement describes.

#### Scenario: Windows without WSL
- **WHEN** the user runs the installer on Windows 11 without WSL
- **THEN** WSL and Ubuntu are installed after the user consents and the computer restarts, the installer resumes on its own, and the setup wizard opens in Windows Terminal

### Requirement: Packaged install updates
An install made by an installer SHALL be recorded as `package` in `~/.remote-harness/install.json`; an install without that record SHALL count as a source install and keep the git-based "Update command". For a packaged install, `remote-harness update` and automatic updates SHALL:
- read the signed manifest of the install's channel and download the runtime bundle for its system;
- refuse it unless both the manifest's signature and the bundle's SHA-256 check out;
- unpack it next to the current runtime, switch to it atomically, refresh launchers, hooks and the shortcut, and restart the service;
- switch back to the previous runtime when the new daemon does not come up.

`doctor` SHALL report the install kind, the runtime version and the channel.

#### Scenario: New release on the channel
- **WHEN** a packaged install on `main` runs 1.4.0 and 1.4.1 is published
- **THEN** `remote-harness update` (or the automatic update) installs 1.4.1, restarts the service and prints `1.4.0 → 1.4.1`, without git or a build

#### Scenario: Tampered download
- **WHEN** the downloaded bundle's SHA-256 does not match the signed manifest
- **THEN** the update stops with an error, nothing is switched and the running version keeps running

#### Scenario: New version fails to start
- **WHEN** the daemon of the new runtime does not come up after the switch
- **THEN** the previous runtime is restored and started, and the update run is recorded as failed

### Requirement: Download buttons
The site's install page SHALL show the download button for the visitor's system first (the `.dmg` on macOS, the `.deb` on Linux, the installer on Windows), linking to the latest `main` release, with the other systems' downloads and the install command still available.

#### Scenario: Visitor on a Mac
- **WHEN** someone opens the install page from macOS
- **THEN** "Download for macOS" leads to the latest `.dmg`, and the install command is still shown below it
