---
title: Getting started
description: Requirements, the one-line install on macOS, Linux and Windows (WSL2), the app, and pairing.
applies: 0.7+
---

## Requirements

- A computer running macOS, Linux (systemd recommended) or Windows 10 2004+ / 11 through WSL2, with `tmux`, `git`, `rg` (ripgrep), `zsh` and `claude` (or `codex`, `gemini`, `kimi`) on the `PATH`. The installer adds the missing tools.
- Node 24+. The installer downloads a private Node into `~/.remote-harness/node` when it is missing, without touching your system Node.
- Nothing to install on the phone besides the app, no VPN: at home the app reaches the computer directly, elsewhere through an end-to-end encrypted connection relay.
- An iPhone or iPad (iOS 17+) or an Android phone (Android 10+).

## Install on the computer

One address for every system: `https://remoteharness.app/install` gives curl the macOS / Linux script and PowerShell the Windows one. Opened in a browser on the computer, it shows the right command with a copy button. Add `?ref=<branch|tag>` for another version, e.g. `curl -fsSL "https://remoteharness.app/install?ref=development" | bash`.

### macOS and Linux

```bash
curl -fsSL https://remoteharness.app/install | bash
```

The installer checks the system and Node, installs the missing tools (Homebrew on macOS; apt, dnf, pacman or zypper on Linux, with `sudo` after telling you why), puts the source in `~/.remote-harness/src`, builds the daemon and opens the guided setup (`remote-harness setup`), which:

- finds your Claude Code accounts (`~/.claude`, `~/.claude-*`) and lets you pick the ones to control, or creates a new one and opens Claude Code there so you can log in;
- asks the alias of each one: the command that opens that account inside tmux (for example `personal`, `work`);
- can add an [OpenRouter profile](/en/docs/daemon/#profiles-and-openrouter): Claude Code paid with your OpenRouter key, which it checks and keeps in the OS secret store;
- installs the launchers, the `PATH` entry and the hooks (with backups), and the background service;
- ends with pairing: it shows the pairing QR code.

Options: `bash -s -- --yes` skips the questions, `bash -s -- --ref <branch|tag>` installs another version, `bash -s -- --update` updates without the setup.

### Windows (WSL2)

Remote Harness drives Claude Code through tmux, so on Windows it runs inside WSL2, where Claude Code is best supported too. In PowerShell:

```powershell
irm https://remoteharness.app/install | iex
```

The script checks Windows 10 2004+ or Windows 11, installs WSL2 with Ubuntu when it is missing (Windows asks for administrator permission; reboot if asked, then run the same command again), helps create the Linux user and runs the Linux installer inside the distribution. Node and Claude Code must be installed inside WSL, not only on Windows. Options: `& ([scriptblock]::Create((irm https://remoteharness.app/install))) -Distro Ubuntu-24.04 -Ref main -Yes -NoService`.

systemd, starting at logon and WSL networking are covered in [Troubleshooting](/en/docs/troubleshooting/#windows-wsl2).

### From a clone

```bash
git clone https://github.com/maarkN/remote-harness.git
cd remote-harness
pnpm install
pnpm --filter @remote-harness/daemon build
node apps/daemon/dist/cli.js setup
```

## Install the app

- **iPhone and iPad**: install it over the air from the **Get the app** card on [remoteharness.app](/en/#app) (open it in Safari; iOS 17+). It is an ad-hoc build, so it installs only on devices registered in the developer team: see [Registering an iPhone or iPad](#registering-an-iphone-or-ipad). Or build it from source: with Xcode on a Mac, `cd apps/mobile && pnpm ios` runs it on the simulator or a connected device; `make install-ios` makes a release build for a connected iPhone or iPad. [CONTRIBUTING.md](https://github.com/maarkN/remote-harness/blob/main/CONTRIBUTING.md#building-and-releasing) has the signing details.
- **Android**: from [Google Play (testing)](https://play.google.com/apps/test/com.alvyntech.remoteharness): join the test, then install it from the Play Store; or the APK from [GitHub Releases](https://github.com/maarkN/remote-harness/releases) (allow installs from your browser when asked), or `pnpm android` and `pnpm build:android` from the repository.

Nothing else goes on the phone: no VPN is needed. At home the app reaches the computer directly over the home network; elsewhere it goes through the connection relay, which only forwards end-to-end encrypted traffic it cannot read.

### Registering an iPhone or iPad

Until the app is on TestFlight, Apple lets the over-the-air build install only on devices whose identifier (UDID) is in the developer team's provisioning profile. On any other device the installation fails. To have yours added:

1. Find the UDID: connect the iPhone or iPad to a Mac, select it in Finder and click the line under its name until the UDID shows (Control-click to copy it). Xcode shows it too, in Window → Devices and Simulators.
2. Send it privately to the maintainer, through the contact on [maarkn.dev](https://maarkn.dev), not in a public issue.
3. Once it is added, the next build published on the install link installs on that device.

Building from source with your own Apple developer account has no such list: Xcode registers your own devices.

## Pair the phone

The setup ends with a QR code; `remote-harness pair` asks the running daemon for a new one at any time, and so do the tray and **Add device** in Settings → Devices of a phone already paired. Each code pairs one device and expires after 5 minutes; a computer takes up to 10 devices, and the app can pair several computers and switch between them. Open the app, scan it, and you are in: the phone creates its own key pair, keeps it in its secure storage and connects directly at home or through the connection relay elsewhere, with everything encrypted end to end (Noise, X25519 and ChaCha20-Poly1305).

Installed the app first? Its pairing screen has a step-by-step guide for the computer side, including the install command to share.

Trying it on a simulator: `remote-harness start --dev` binds the daemon to `127.0.0.1` (and never uses a relay) and `remote-harness pair` prints a code with that address: paste the link in the app's **Paste link** tab. On the Android emulator also run `adb reverse tcp:7337 tcp:7337`.

## First session

Run your alias instead of `claude`, with the same arguments:

```bash
personal            # opens Claude Code in tmux with that account
work --resume       # another account
```

Both appear in the app, fully controllable. Sessions started with plain `claude` outside tmux appear too, read-only, and can be resumed from the phone.

## Update

`remote-harness update` fetches the new version, rebuilds, refreshes the hooks and restarts the service without asking the setup questions. The background service also checks for updates every 6 hours and shows a desktop notification; see [updates and channels](/en/docs/daemon/#updates-and-channels).
