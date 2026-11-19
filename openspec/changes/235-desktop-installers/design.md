## Context

See proposal.md for the why. Today an install is a git checkout in `~/.remote-harness/src`, built on the computer by `install.sh`. Node 24 is downloaded when missing, and tmux and ripgrep come from Homebrew on macOS or from the system on Linux. `remote-harness update` fetches a git ref and rebuilds.

On macOS the daemon also compiles two programs on the computer, which is why the Xcode command-line tools are needed:
- the tray helper, compiled with `swiftc` (`infra/tray-helper.ts`);
- the C launcher inside the ad-hoc signed `~/.remote-harness/Remote Harness.app` that the LaunchAgent runs (`features/service/launchd.ts`).

On Windows the daemon runs in WSL and its tray is C# compiled by Windows PowerShell on the host (ADR-0005), which needs no toolchain.

The daemon has no native Node modules, so its built output plus a Node runtime runs anywhere that runtime runs. The Apple Developer Program enrollment already exists (store distribution, #161).

## Goals / Non-Goals

**Goals:**
- One build of each release produces everything every installer needs. The installers are thin around it.
- Everything runs as the user and lives under `~/.remote-harness`, as today. No admin rights after the first install, none at all on macOS and Linux.
- Packaged installs update themselves on both channels, verified end to end.

**Non-Goals:**
- A graphical setup: the existing wizard runs in a terminal (decided with the user).
- Bundling the agents' CLIs (Claude Code, Codex, …): they stay the user's, and `doctor` keeps reporting them.
- App stores for the desktop (Mac App Store, Microsoft Store, Snap Store, Flathub). Their sandboxes do not fit a daemon that drives tmux.
- Replacing `install.sh`: it stays the path for developers and servers.

## Decisions

### 1. A per-system runtime bundle is the release unit

CI builds, for `darwin-universal` (arm64 + x86_64), `linux-x64` and `linux-arm64`, a `remote-harness-runtime-<version>-<system>.tar.zst` with:
- the official Node 24 binary, its checksum checked against nodejs.org's `SHASUMS256.txt` at build time;
- the daemon's `tsup` output with `node_modules` for production only;
- the tray helper and, on macOS, the LaunchAgent launcher, prebuilt and signed;
- on macOS, `tmux` (libevent linked statically) and `ripgrep` (its official release binaries, joined into one universal binary with `lipo`).

Every installer embeds the bundle for its system, and updates download it.

- *Instead of a Node single executable application (SEA):* one file is tidier, but the helpers, tmux and the docs still have to sit next to it, `tsup`'s chunks and dynamic imports need work to embed, and every platform needs its own injection and re-signing. It can be revisited later without changing the bundle's role.
- *Instead of building on the computer, as `install.sh` does:* building is what brings in the toolchain requirement this change removes.

### 2. Code lives per user, under `~/.remote-harness/runtime/<version>`

Each bundle is unpacked into `~/.remote-harness/runtime/<version>`, and `runtime/current` is a symlink that is swapped atomically. Every other path stays as it is: `bin/`, `config.json`, logs and state. The `remote-harness` shortcut and the service point into `runtime/current`.

An install record, `~/.remote-harness/install.json`, holds `{ kind: "source" | "package", version, channel }`. It is written by `install.sh` (`source`) and by the installers (`package`). When it is missing, the install counts as `source`, which is every install made so far.

- *Instead of running from inside `/Applications/Remote Harness.app`:* updating would mean replacing a bundle in `/Applications`, which can need admin rights, and Gatekeeper would re-check it. A per-user runtime downloaded by the daemon carries no quarantine flag and is the user's to replace.

### 3. macOS: a notarized `.dmg` with a starter app

`Remote Harness.app` is signed with the Developer ID Application certificate, notarized and stapled, inside a `.dmg` with the usual drag-to-Applications layout. The app is a small starter that embeds the runtime bundle. On every open it does three things:
1. Installs the embedded bundle when it is newer than `runtime/current`, or when nothing is installed.
2. On the first install, writes the shortcut and the PATH block (`remote-harness install`, without profiles yet), then opens a terminal running `remote-harness setup` (decision 6).
3. On later opens, starts the service if it is installed but not running, so the tray icon comes back.

The LaunchAgent runs the runtime's signed `Remote Harness.app` launcher instead of an ad-hoc bundle built on the computer. Its Developer ID signature stays the same across updates, so the folder-access and notification grants survive them. With an ad-hoc signature they reset whenever the contents change.

- *Instead of a `.pkg`:* its scripts run as root, while the setup and everything it writes belong to the user. A `.pkg` would also install for every user of the computer, which the per-user runtime does not need.
- *Also cheap to add later:* a Homebrew cask that points at the same `.dmg`.

### 4. Linux: a `.deb` for the system pieces, the same per-user runtime

The `.deb` (amd64, arm64) installs `/usr/lib/remote-harness` with the embedded bundle and a starter script, plus `remote-harness-setup.desktop` in the applications menu. It declares `Depends: tmux, zsh, ripgrep, python3-gi, gir1.2-ayatanaappindicator3-0.1`, so apt brings in what the launchers and the tray use. The starter does what the macOS app does (decision 3). The terminal it opens is `$TERMINAL`, else `x-terminal-emulator`, else the first of `gnome-terminal`, `konsole` or `xterm` found.

- *Instead of an apt repository for updates:* it would need hosting and key management, and it would still update only the system half. The daemon updates the per-user runtime itself (decision 7), so the `.deb` is rarely needed again.
- *Instead of an AppImage:* it cannot bring in tmux and zsh, and those are what a clean system lacks. RPM, AppImage and Flatpak are left to demand.

### 5. Windows: a signed Inno Setup installer that sets up WSL

`Remote-Harness-Setup-<version>.exe`, built with Inno Setup and signed with Authenticode, works in four steps:
1. It checks `wsl.exe --status`. Without WSL it asks to install it (`wsl.exe --install --no-distribution`), elevating for that step only, and resumes after the reboot through a `RunOnce` entry.
2. Without a distribution, it installs Ubuntu. Ubuntu's own first run asks for the Linux user name and password, in a window, and that is not a command.
3. Inside the distribution it unpacks the `linux-x64` runtime bundle with the same per-user layout (decision 2). It installs `tmux`, `zsh` and `ripgrep` with `apt` when they are missing, which asks for the Linux password through `sudo`, as `install.sh` does today.
4. It opens Windows Terminal (`wt.exe wsl.exe -d <distro> -- remote-harness setup`), or a console window when Windows Terminal is missing.

The tray stays as ADR-0005 describes, with nothing to prebuild.

- *Instead of MSIX:* its container does not allow enabling WSL or running `wsl.exe --install`.
- *Instead of WiX/MSI:* it is heavier for a flow that is mostly scripted steps with one reboot.

### 6. First run: a terminal running the existing wizard

As decided, setup stays `remote-harness setup` in a terminal, which the installer opens with the command already running, so nothing has to be typed. On macOS it opens Terminal.app, through the same AppleScript `DARWIN_TERMINAL_APPS` uses, until #615 lets the user pick a default terminal. When the wizard ends, the service is running, the tray is visible and the pairing QR has been offered, as today.

- *Instead of a native first-run window in the tray (profiles, pairing QR):* the experience would be nicer, but it is a new UI per system that duplicates the wizard. It can come later on top of the same steps.

### 7. Updates of packaged installs

With `kind: "package"`, `remote-harness update` and automatic updates work in six steps:
1. Read `https://remoteharness.app/desktop/<channel>.json`, a small manifest the release workflow publishes on the site, as it already does for OTA. It lists the version and each asset's URL and SHA-256. The assets themselves stay on GitHub Releases.
2. Download the runtime bundle for this system.
3. Check its SHA-256 against the manifest. Check the manifest's Ed25519 signature against a public key built into the daemon, using Node's `crypto`, with no new dependency.
4. Unpack into `runtime/<version>` and swap `runtime/current`.
5. Run the install step (launchers, hooks, shortcut) from the new runtime, then restart the service.
6. Keep the previous runtime, and switch back to it when the new daemon does not come up (the update run record already tracks `restarting` → `done`). Older runtimes beyond the previous one are deleted.

`main` follows releases and `development` follows pre-releases, the same channels as today. Installs from `install.sh` keep the git-based update unchanged. `doctor` reports the kind, the runtime version and the channel.

- *Instead of Sparkle, WinSparkle or the AppImage update tools:* each covers one system and none of them updates a per-user runtime that a daemon restarts by itself. The update run record and the tray's update UI already exist.

### 8. Download buttons

The install page picks the visitor's system like the install command does and shows its download button first (`.dmg`, `.deb`, `.exe`), with the command right below for those who prefer it. The links point at the latest release in the `main` manifest.

## Risks / Trade-offs

- **Signing secrets in CI.** The Developer ID certificates, the App Store Connect API key, the Authenticode certificate and the release key are high-value secrets. → Only the release workflow can use them, behind a protected GitHub environment that needs approval. The release key is used only to sign the manifest.
- **Bundled tmux falls behind.** → Pin the tmux version, rebuild on each tmux release and security fix, and show the bundled version in `doctor`. A user's own `tmux` on the PATH is never touched. The dedicated server always runs the bundled one, so its version is the same everywhere.
- **Two install kinds to maintain.** → `install.json` decides the update path in one place, and both paths keep their own tests. Packaged installs never run `git`, and source installs never download bundles.
- **The WSL setup needs admin rights and a reboot, and Ubuntu's first run asks for a user.** → Elevation is requested only for that step, and the installer resumes after the reboot. The Linux user prompt is Ubuntu's own window, which is not a command to type.
- **A bad release breaks every packaged install at once.** → Pre-releases go to `development` first. The previous runtime is kept and rolled back to automatically. Assets stay on GitHub Releases, so an older release can always be reinstalled from the site.
- **Gatekeeper and SmartScreen.** → The `.dmg` and the app are notarized and stapled. SmartScreen reputation builds over time, and an EV or Trusted Signing certificate shortens that.

## Migration Plan

Existing installs stay `source` (no `install.json`) and change nothing. Opening the macOS app, the `.deb` or the Windows installer on a computer that has a source install keeps `config.json`, the profiles, the pairing and the service. They switch it to `package`, point the shortcut and the service at the runtime, and leave `~/.remote-harness/src` in place, with a note that it can be deleted. Going back means running `install.sh`, which rewrites `install.json` to `source`.

The work ships in follow-up issues: the shared pipeline and packaged updates first, then macOS, Linux and Windows, each usable on its own once the pipeline exists.

## Open Questions

- Release asset hosting: whether GitHub Releases' bandwidth is enough long term, or whether the assets should be mirrored on remoteharness.app. The manifest's URLs make the switch transparent.
- Whether the Windows installer should create the Linux user for a fresh Ubuntu (`ubuntu.exe install --root`, then a user named after the Windows one) to save that one prompt.
