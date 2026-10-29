---
title: Troubleshooting
description: Connection, the connection relay, push, sleep, read-only sessions, aliases, WSL, version mismatch, OpenRouter.
applies: 0.7+
---

Start with `remote-harness doctor` on the computer: it checks the tools, the config, the profiles and provider keys, the daemon identity, whether the connection relays answer, the service, push and the registered phones, and prints the command that fixes each failed check.

## The app cannot connect

- At home the app reaches the computer directly over the home network; elsewhere it goes through the connection relay, both end-to-end encrypted. The computer and the phone must both be online. If it connects only at home, see [away from home](#the-phone-can-t-reach-the-computer-away-from-home).
- The daemon must be running: `remote-harness service status`, or `remote-harness start` in a terminal to see the log.
- A reinstall that removed the daemon's keys means pairing again: **Forget this machine** in Settings, then scan a new `remote-harness pair`. After the update that brought end-to-end encryption every phone pairs once more; the pairing screen says so.
- "Already used or expired": a pairing code works once, for 5 minutes. Run `remote-harness pair` for a new one.
- On a simulator or emulator, use `remote-harness start --dev` and `remote-harness pair`, then paste the link in the app's **Paste link** tab (Android emulator: also `adb reverse tcp:7337 tcp:7337`).

## The app says the computer isn't reachable

When the paired computer does not answer at all, the session list shows the same checklist, plus **Try again** and a link to this page: the computer is on and awake (not sleeping, lid open, or set not to sleep), the daemon is running (`remote-harness status`), and both the computer and this phone are online. The sections on this page cover each of these in detail; it disappears by itself as soon as the connection opens.

## The phone can't reach the computer away from home

Away from home the app goes through the connection relay. If it connects at home but not elsewhere:

- `remote-harness doctor` shows whether the connection relays answer from the computer.
- A firewall or proxy that blocks outbound `wss://` (port 443) to the relay keeps the daemon off it: allow `us.relay.remoteharness.app` and `br.relay.remoteharness.app`, or [run your own](/en/docs/daemon/#self-hosting-the-connection-relay).
- `"relay": "off"` in the config keeps the daemon off the relays; only the direct path works then.
- A daemon started with `--dev` never uses a relay.
- On a cloud server, or when the connection keeps dropping and coming back, see [Cloud server](/en/docs/cloud-server/#unstable-connections).

## Push does not arrive

- The app must have the notification permission; Settings → Notifications shows the state and has **Send test notification**.
- `remote-harness push status` shows the mode: the relay (the app build needs the relay URL), your Firebase service account at `~/.remote-harness/firebase-service-account.json`, or `off` in the config.
- A profile or session may be muted: check the **Muted** row in Settings.
- With the relay, each phone needs a grant: `doctor` says when none has one.
- On Android, notifications use the high-priority `claude-remote` channel; check it is not silenced in the system settings. Allow and Deny buttons are not shown on Android notifications: tap to answer in the app.

## The computer sleeps or locks

The daemon only works while the computer is awake. Locking the screen is fine. By default the background service keeps the computer from idle-sleeping while a session is running or waiting, and for 10 minutes after; the display still turns off and the screen still locks. Change it with `remote-harness keep-awake off`, `sessions` or `always`; `doctor` shows whether it is holding. A laptop still sleeps when the lid closes, unless it is on power with an external display. When the app says the computer is not answering, it is probably asleep: wake it and the app reconnects by itself. Sessions in tmux survive a disconnection of the app.

The app cannot wake a sleeping computer: Wake-on-LAN only works on the computer's own network. If the computer supports Wake-on-LAN (usually over Ethernet) and another device on the same network stays on and can be reached from the phone (a Raspberry Pi, a NAS, a router with WoL), you can wake it from there, for example `ssh pi@raspberrypi wakeonlan AA:BB:CC:DD:EE:FF` with the computer's MAC address.

## macOS asks for folder access

The first time a session works in Documents, Desktop, Downloads or an external drive, macOS asks whether **Remote Harness** may access that folder: allow it once and it sticks, also across `remote-harness update`. To avoid one prompt per folder, add Remote Harness under System Settings → Privacy & Security → Full Disk Access. If the prompt names **node** instead, the Command Line Tools are missing: run `xcode-select --install`, then `remote-harness service install` (`doctor` shows this check).

## Sessions are read-only

A session started with plain `claude` outside tmux appears in the app but cannot be typed into. Tap **Resume** to reopen it inside tmux, fully controllable, with the same history. Always start sessions through your alias to avoid this.

## The alias is not found

The launchers live in `~/.remote-harness/bin`, added to the `PATH` of `~/.zshrc` and `~/.bashrc` by the setup. Open a new terminal (or `source ~/.zshrc`); if the alias is still missing, run `remote-harness install`. Launchers run with `zsh`, which the installer adds on Linux when missing.

## The alias says "missing or unsuitable terminal"

The computer has no description (terminfo) of your terminal, common when you SSH in from Ghostty or kitty (`xterm-ghostty`, `xterm-kitty`). Run `remote-harness install` to regenerate the launchers: they fall back to `xterm-256color` when the terminal is unknown. To keep your terminal's features, copy its description to the computer: `infocmp -x "$TERM" | ssh <host> -- tic -x -`.

## App and daemon versions differ

The app says when the daemon is older than it needs. Run `remote-harness update` on the computer (or update from the tray). The app itself updates over the air when it was built with an update server; Settings → App shows the version and **Check for updates**.

## Windows (WSL2)

- **systemd**: the background service needs `[boot] systemd=true` in `/etc/wsl.conf`; the setup shows the command and asks you to run `wsl --shutdown` from PowerShell afterwards.
- **Starting at logon**: WSL only runs while something uses it. The setup can create the Windows scheduled task "Remote Harness" that starts the distribution at logon; `remote-harness service uninstall` removes it. If WSL still stops when idle, raise `vmIdleTimeout` in `[wsl2]` of `%UserProfile%\.wslconfig`.
- **Networking**: the connection relay works with WSL2's default NAT networking. To let devices on the same network use the direct path too, turn on mirrored networking (Windows 11 22H2+): the setup offers to add `networkingMode=mirrored` to `[wsl2]` in `%UserProfile%\.wslconfig`, then run `wsl --shutdown`.
- `remote-harness doctor` shows the distribution, the networking mode, systemd and the logon task.

## An OpenRouter profile will not start

The launcher refuses to open a window when the profile has no key and prints the command to run: `remote-harness provider key <profile>`. `doctor` lists the provider profiles and whether each has a key. Open sessions keep the key they started with; new ones read it again.

## Moving from a development build to the store build

When the TestFlight or Google Play build is available, install it next to the build you have: it is a separate app (`com.alvyntech.remoteharness`; builds up to v0.19 are `tech.doctorx.clauderemote`), so it starts empty. Pair it again by scanning `remote-harness pair`; the old pairing keeps working until you tap **Forget this machine** in that build. Push registers itself on the first launch of the new build, and the computer drops the old registration once it stops connecting. Then delete the development build.

## The app is slow or freezes

Turn on Settings → Error reports → **Send performance data** on that phone (builds with Firebase only) and use the app as usual. After some minutes, the Firebase console's **Performance** page shows, per device model and OS:

- `_app_start` and the custom `app_ready` trace (`ready_ms`: from the app's start to the first connection to your computer; `outcome` `connected` or `timeout`);
- `js_responsiveness`: one trace per stretch in the foreground, with `stalls` (JavaScript blocked 1 s or more), `long_stalls` (5 s or more), `stall_max_ms` and `stall_total_ms`, filterable by `layout`;
- slow and frozen frames under **Screen rendering**.

A freeze that ends with the system closing the app loses its last `js_responsiveness` trace. A long `app_ready` or a crash in Crashlytics on the next start is still a hint. Debug builds only send with Firebase's debug flag on.

## Getting help

Open an issue with the output of `remote-harness doctor`, the versions (OS, Node, Claude Code, the app) and the daemon logs from `~/.remote-harness/logs`, after removing tokens and session content. Security problems go to [Security & privacy](/en/docs/security/#reporting-a-vulnerability), never to public issues.
