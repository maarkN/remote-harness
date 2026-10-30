---
title: Security & privacy
description: What the daemon can do, what leaves your machine, keys and pairing, and how to report a problem.
applies: 0.7+
---

## What the daemon can do

The daemon can type into your Claude Code sessions and approve tool calls, so it is effectively a remote shell on your computer. It is locked down by default and nothing in it is reachable from the internet.

## Network

- The app reaches the daemon directly (a WebSocket on every interface of the computer, or only `127.0.0.1` with `--dev`) or through a connection relay. On both paths every byte is end-to-end encrypted, and a connection that does not complete the handshake with a paired key gets nothing at all; the relay only forwards ciphertext and cannot read your sessions.
- Claude Code's hooks reach the daemon on `127.0.0.1` only, with a local shared secret.
- `relay: off` or `direct: off` in the config turns a path off; `remote-harness devices revoke <id>` unpairs a phone at once.

## Keys and pairing

- Every connection is a Noise protocol session (X25519, ChaCha20-Poly1305) encrypted end to end between the phone and the daemon. The daemon's own keys live in the macOS Keychain, the Linux Secret Service (`secret-tool`) or a `0600` file; each phone creates its key pair when it pairs and keeps it in its secure storage, on that device only.
- A pairing code (`remote-harness pair`, the setup or the tray) works once and only for 5 minutes. The daemon keeps the paired phones' public keys (at most 10) and drops any connection whose key it does not know, before sending anything.
- Provider keys (OpenRouter) live in the same store, under their own account. They are never written to `config.json`, `settings.json`, shell files or the launchers, never logged, and never sent to the phone: the launcher reads the key inside the tmux window, and the daemon only uses it to ask the provider for your credits.

## What leaves your machine

- Push notifications carry a title, the profile and the session id. The live status adds the session name, the folder, the state, the current step (the tool and a short target such as a file's base name or a command's program, never its arguments) and the todo progress. Never the conversation.
- With the push relay, the relay sees those same content-free messages and a sealed grant (your FCM token); it stores nothing. With your own Firebase project, nothing goes through anyone else.
- The daemon sends no telemetry. The update check talks to the git remote of the installed source.
- The OpenRouter catalog and credits requests go from the computer to OpenRouter, nowhere else.

## Shell commands

Running commands from the app (**Run command…**) is off by default and can only be turned on from the computer (`remote-harness commands on`). When on, a paired phone can run any command as your user in a session's folder, so the app confirms every command first. Each run has a time limit and an output limit, is killed with its whole process group on cancel, and its output goes only to the phone that started it: commands and output are never logged, stored, sent to other phones or put in a push notification.

## Permissions

The app never offers the agent's "bypass permissions" mode. "Always allow" writes a rule in Claude Code's own settings, for the project or for your user, and Settings → Permissions → Rules (or `remote-harness rules undo`) reverts it; deleting a rule written on the computer asks for Face ID or the device passcode. The approval log records which device allowed or denied what, with only the tool and a short target (a file's base name, a command's program), never the input, and keeps 30 days. An unanswered request falls back to the terminal dialog after a few minutes.

## Your files

The installer edits `settings.json`, `~/.zshrc` and `~/.bashrc` the same way every time: read, merge, back up, write atomically. `remote-harness uninstall` removes exactly what it added. The plain `claude` command is never changed.

## Reporting a vulnerability

Please do not open a public issue. Report privately through [GitHub Security Advisories](https://github.com/maarkN/remote-harness/security/advisories/new) with a description, the impact, steps to reproduce (versions of the OS, Node, Claude Code and the app) and any suggested fix. You can expect an acknowledgement within a few days; once fixed, the advisory is published with credit unless you prefer to stay anonymous. Only the latest release on `main` receives security fixes. The full policy is in [SECURITY.md](https://github.com/maarkN/remote-harness/blob/main/SECURITY.md).
