---
title: Documentation
description: How to install, pair, use and troubleshoot Remote Harness.
---

Remote Harness lets you follow and drive Claude Code, Codex, Gemini CLI, Kimi CLI and Qwen Code sessions that run in tmux on your own computer, from your phone, from anywhere and encrypted end to end. These pages cover the user side; the code, the architecture and the specifications live in the [repository](https://github.com/maarkN/remote-harness).

## Pages

- [Getting started](/en/docs/getting-started/): requirements, the one-line install on macOS, Linux and Windows (WSL2), the app, pairing.
- [Using the app](/en/docs/using-the-app/): session list, conversation, prompts, permissions, terminal, sessions and worktrees, live status, notifications, profiles and OpenRouter, settings.
- [The daemon](/en/docs/daemon/): CLI commands, the configuration file, the background service, updates and channels, the tray icon, logs.
- [Cloud server](/en/docs/cloud-server/): run the daemon on a cloud VM (AWS, DigitalOcean, GCP, Oracle): ports and firewalls, the service without a login, the terminal over SSH, unstable connections.
- [Security & privacy](/en/docs/security/): what the daemon can do, what leaves your machine, keys and pairing, reporting a problem.
- [Troubleshooting](/en/docs/troubleshooting/): connection, the relay, push, sleep, read-only sessions, WSL, version mismatch.
- [Contributing](/en/docs/contributing/): how the project is built and how to help.

## Quick start

1. On the computer: `curl -fsSL https://remoteharness.app/install | bash` (Windows: `irm https://remoteharness.app/install | iex` in PowerShell).
2. Install the app on the phone, then scan the QR code the setup shows at the end.
3. Run your alias (for example `work`) instead of `claude`. The session appears on the phone, fully controllable.
