---
title: Privacy policy
description: What Remote Harness collects (only the error reports and performance data you agree to send), what stays on your devices, what leaves your machine and when, and how to reach us.
applies: 0.7+
---

Remote Harness is self-hosted software: the daemon runs on your computer, the app on your phone, and they talk over your own Tailscale network. This page is the privacy policy of the app distributed through the stores, of the daemon, and of this website, published by Alvyn Tech ("we"). Its short address is [remoteharness.app/privacy](/privacy). Last updated on 2026-10-24.

## What we collect

Only the error reports and the performance data you agree to send. There is no account and no analytics, and nothing else is collected by the app, the daemon or this website. The maintainers never receive your conversations, your files, your prompts, your tokens or your keys.

**Error reports (opt-in).** The app keeps a small log of its own errors on the phone. It sends them to Firebase Crashlytics (Google) only as you choose in Settings → Error reports: after asking you, which is the default, automatically, or never. A report holds the time and kind of error, the error name, a scrubbed message and stack, the failed request type and error code, the screen's route pattern, and the app, update, OS and daemon versions; Crashlytics adds the device model and an installation id. Reports never include prompts, conversation, terminal output, commands, file paths, project or session names, tokens or pairing data. Settings → Report a problem also lets you share a report yourself or post it as a GitHub issue. Google's handling of Crashlytics data is covered by Google's privacy policy.

**Performance data (opt-in, off by default).** With Settings → Error reports → Send performance data on, the app sends Firebase Performance Monitoring (Google) how long it takes to start and to reach your computer, its slow and frozen frames, how often and how long its JavaScript stalls (with the layout class: phone, tablet or wide), and on iOS the timing of its own requests to the push relay and the update server. Firebase adds the device model, OS and app versions, country and an installation id. This data never includes your sessions, prompts, paths, names or your computer's address. Turning the switch off stops it on that phone.

## What stays on your devices

- On the phone: the pairing token (in the system's secure storage), the app's preferences (theme, language, machine name, notification and error report choices), the log of the app's own errors, the unsent prompt drafts of each session (in the system's secure storage, never sent anywhere, deleted when sent, after 7 days or when you forget the machine), and nothing else from the conversations beyond what is on screen.
- On the computer: the daemon's configuration, the list of known sessions, its logs, and the provider keys in the OS secret store.

Deleting the app and running `remote-harness uninstall` remove them.

## What leaves your machine, and when

- **Between your phone and your computer**: the conversation, the permissions you answer and the prompts you send travel only over your Tailscale network, authenticated with the pairing token. Nothing of it reaches us. Commands run from the app (**Run command…**, off by default) and their output take the same path, only to the phone that started them, and are never stored. With **Polish dictation** on (off by default), the transcript text of a dictation goes to your computer, where the session's own `claude` command rewrites it under your own Anthropic account, like any prompt you send; the audio never leaves the phone.
- **Push notifications (optional)**: a title, the profile name, the session id and the event type go through Firebase Cloud Messaging (Google) to your phone; the live status adds the session title, the folder, the state, the current step (the tool and a short target: a file's base name, a command's program, a web address's host or a subagent type, never arguments, file contents or search terms) the progress of the todo list and a fixed phrase for what the session is doing (such as "Running tests…"). Only if you turn on Settings → Notifications → Show the current task on the lock screen (off by default), it also carries the task in progress from the session's todo list, up to 48 characters. The push relay is a small service we run that forwards those same messages and stores nothing; with your own Firebase project, nothing passes through us. Google's handling of Firebase Cloud Messaging is covered by Google's privacy policy.
- **Updates**: the daemon checks the git remote of the installed source for new versions; the app checks the update server configured in its build for new JavaScript (the request carries the app version and platform, no personal data).
- **OpenRouter profiles (optional)**: the model catalog and credits requests go from your computer to OpenRouter with your key; no model traffic passes through us.
- **This website**: served from the project's own server through Cloudflare, which both log requests like any host; the fonts come from Google Fonts. No cookies, no analytics.

## Permissions the app asks for

- **Camera**: to scan the pairing code and attach photos to a prompt.
- **Microphone and speech recognition**: to dictate prompts; the transcription runs on the device.
- **Notifications**: for push and the live status, which you can turn off at any time.

## How your data is protected

Traffic between the phone and the computer is encrypted end to end by Tailscale (WireGuard) and authenticated with the pairing token; the daemon only listens on the Tailscale interface. Error reports, performance data, push messages and updates travel over HTTPS. Updates are signed, and the app refuses one without a valid signature. The pairing token and the drafts are kept in the system's secure storage.

## Your choices and requests

- Turn error reports and performance data off at any time in Settings → Error reports; nothing more is sent from that phone.
- Delete what stays on your devices by forgetting the machine in the app, deleting the app and running `remote-harness uninstall`.
- To access or delete the error reports and performance data already sent to Firebase, write to [privacy@remoteharness.app](mailto:privacy@remoteharness.app). They carry no name or account, so tell us the approximate date and the device model, and we delete the matching data. Firebase also deletes it on its own after its retention period ([Firebase privacy](https://firebase.google.com/support/privacy)).

## Children

Remote Harness is not directed at children under 13 and collects no data from anyone.

## Changes and contact

Remote Harness is published by Alvyn Tech. Privacy questions and requests: [privacy@remoteharness.app](mailto:privacy@remoteharness.app). This policy changes only through the [repository](https://github.com/maarkN/remote-harness), where its history is public, and the date at the top changes with it. Other questions go to a GitHub issue; security reports go through [GitHub Security Advisories](https://github.com/maarkN/remote-harness/security/advisories/new), as described in [Security & privacy](/en/docs/security/).
