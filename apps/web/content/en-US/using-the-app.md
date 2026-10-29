---
title: Using the app
description: Session list, conversation, prompts, permissions, terminal, sessions and worktrees, live status, notifications, profiles and OpenRouter, settings.
applies: 0.7+
---

## Session list

The home screen lists the sessions of every profile on the paired computer, newest activity first (the sort chip switches to grouping by state). Each row shows the agent badge, the title, the folder and branch, the state (`running`, `waiting`, `idle`, `ended`) and the profile tag; chips filter by profile. A **Waiting for you** strip on top collects the permission requests, with Allow, Always and Deny right there. Swipe a row for the quick actions (close or resume, mute, pin); long-press or tap the row's menu for the rest (copy the path, hide an ended session, clean up its worktree). Sessions that share a git checkout with another live session are marked, since they can step on each other's files.

The line under the title names the computer and how many sessions it has; tap the name to switch to another paired computer or add one. "via relay" there means the app reaches it through the connection relay: at home it moves to the direct path by itself, without losing the conversation. Notifications keep arriving from every paired computer, and tapping one opens it on its computer. The `+` button starts a new session.

## Conversation

Open a session to read the conversation as it happens: prompts, the agent's text in Markdown, thinking, tool calls with their results, diffs and images, paginated back to the start. Under the header, the first context line shows the agent badge, the profile, the folder (tap it for the session details), the state and the permission mode; the second line shows the model (with the effort level), the provider when the profile has one, the branch, the context window usage and the account's usage limits. Tap it for the numbers.

**Conversation history** (in the menu) lists your prompts newest first and jumps to one. **Follow output** keeps the view at the bottom while the agent works; scroll up to pause it.

## Sending prompts

Type in the composer and send. While the agent is busy the prompt is queued and delivered in order when the turn ends; the **Queue** card lets you edit, reorder, remove or send an item now. Hold the send button (or press ⌘⏎ with a keyboard) to send immediately, like Ctrl+Enter in the terminal.

What you type is kept as the session's draft: leave the session, open another one or close the app, and it is there when you come back, photos included. The session list marks rows with a draft (**Draft:** and the start of the text). Sending clears it; emptying the field discards it. Drafts stay on the phone and expire after 7 days.

- `@` completes files of the project, `/` completes Claude Code's slash commands.
- The camera button attaches photos; the microphone dictates on-device (set the language in Settings → Voice).
- **Show keyboard shortcuts** (menu) adds a key bar with Esc, Ctrl+C, the arrows, Tab and Enter for the agent's own menus.

## Permissions

When the agent asks for permission the app shows the tool and the command or file, with **Allow**, **Deny** and **Always**. "Always" writes a rule in the agent's settings, for the project or for your user, exactly as the terminal dialog would; Settings → Permissions → **Rules** lists every always-allow rule of the computer: rules created from a device can be undone, rules you wrote on the computer can only be deleted there, after Face ID or the device passcode (a backup of the settings file stays next to it). **Activity** shows what each device allowed, denied, undid and deleted in the last 30 days, never the tool input. On the computer, `remote-harness rules list`, `remote-harness rules undo <id>` and `remote-harness approvals list` do the same. The daemon waits for your answer for a few minutes before letting the terminal dialog take over, so an unanswered request never blocks the session for good. When the agent asks a question with options, the options are shown too.

The **mode** chip switches the permission mode: default, accept edits, plan and auto. The app never offers "bypass permissions".

## Raw terminal

**View terminal** (menu, or the terminal button in the header) shows the tmux pane itself, for menus and anything the structured view does not cover, with the same key bar. Read-only sessions (no tmux pane) cannot be typed into.

## Running a command

**Run command…** (session menu) runs a shell command in the session's folder on the computer, like Claude Code's `!`, and streams its output: `git status`, `ls`, `pnpm test`. The app asks before every command; **Stop** kills it, **Copy output** copies it and **Add to prompt** puts the command and its output in the composer as a code block for the agent, without sending it. It is off until you run `remote-harness commands on` on the computer; commands have a time limit and an output limit, and nothing interactive works (there is no keyboard input).

## Reviewing changes

**Review changes** (session menu) lists the files of the session's checkout (or worktree) that differ from `HEAD`: added, modified, deleted, renamed and untracked files with their `+added −deleted` counts, without asking the agent. Tap a file for its diff; lockfiles, generated files (`dist/`, `*.generated.ts`) and big diffs start collapsed, binary files only say "binary changed", and long diffs load 2,000 lines at a time with **Show the rest**. The list refreshes while the session works and on pull, whatever the session is doing.

From the same screen you can close the loop: untick the files to leave out, type the commit message or tap **Generate** (the session's own Claude Code writes it from the diff, with a small model and no tools), then **Commit**, **Push** and **Open PR**. Each one first shows what it touches: the files, the branch and the remote. On the default branch the commit offers to create a new branch first, named from the message; a push straight to `main` or `master` gets a warning. **Open PR** uses `gh` when it is installed on the computer (title and body can be generated too); without it, **Push & compare** pushes and opens GitHub's "compare & open PR" page. While the agent is working these buttons wait for it, with a **Do it anyway** after a warning. They are fixed operations of the daemon, not shell commands, so they work with `remote-harness commands` off.

## Subagents

While the agent delegates work, the header's menu shows **Subagents (N · M running)**; the sheet lists each one with its description, state, tool count and start time, plus the background tasks.

## Starting, resuming and closing sessions

**New session** (the `+` button) asks for the profile, the model when the profile has a provider, and the directory: type it with autocomplete, browse the folders, or pick a recent one (with its branch and how often it was used this week). Turn on **Isolated copy (git worktree)** to start Claude Code with `--worktree`: it works on its own branch in `<repo>/.claude/worktrees/<name>`, so two sessions can share a repository without touching each other. The copy keeps the project's local permissions: Claude Code reads the main checkout's `.claude/settings.local.json` from the worktree (or copies it), and copies the git-ignored files listed in `.worktreeinclude` at the repository root (gitignore syntax, e.g. `.env`). The screen lists what will carry over under the switch. Starting in a checkout another live session already uses asks first. An optional **Name** (with the branch and recent session names as suggestions) becomes the session's title right away, Claude Code's `--name`, and the worktree's name when the isolated copy is on.

**Resume** reopens an ended or read-only session inside tmux, with the same history. **Close** ends the session; when it ran in a worktree, the app offers to delete it only when it is clean and pushed, to commit and push first, or to discard the work, asking twice before discarding anything.

## Live status

On iOS, a running session shows a Live Activity on the lock screen and in the Dynamic Island with the state, the current step and the elapsed time; a permission request adds Allow and Deny buttons. On Android it is a silent notification without buttons: tap it to answer in the app. It never carries the conversation. Turn it off in Settings → Notifications → Live status.

## Notifications and mute

Push notifications tell you when a session needs a permission, finishes a turn or asks a question; they carry a title, the profile and the session id, never the content. Settings → Notifications has the switch for this phone, a test button and the live status switch. Mute a profile or a session from its row or from the session menu; the **Muted** row in Settings lists everything muted.

A finished or waiting session's notification has actions: **Reply** (type, or dictate with the keyboard's mic), **Reply by voice** (opens the session already recording and sends when you finish), **Interrupt** (Escape) and, when prompts are queued, **Send next queued**. Permission notifications keep Allow and Deny only. Every action needs the phone unlocked, and the answer goes from the phone straight to the computer over the encrypted connection, never through the push relay. On Android the actions come with app builds from this version on; older builds show the plain notification.

## Siri and Shortcuts

On iOS 16 or later, Siri and the Shortcuts app can act on the active computer without touching the app: **Reply to a session** ("Reply in Remote Harness", then dictate the message; it goes to the session that needs you, or the one you name), **Answer the pending permission** ("Answer Remote Harness": Siri reads what the oldest permission asks and confirms before allowing or denying) and **What's waiting** ("What's waiting in Remote Harness"). Questions and plans still need the app. Every action needs the phone unlocked and goes straight to the computer over the encrypted connection. When the app is closed, Siri asks to continue in Remote Harness (iOS 17 or later) and finishes there. Session titles offered to Siri stay on the phone.

## Profiles and OpenRouter

A profile is a Claude Code account, that is a `CLAUDE_CONFIG_DIR`, with a name, a color and an alias. A profile can also route Claude Code through **OpenRouter**: its rows show a dashed `via OpenRouter` chip, **New session** gets a **Model** row with a searchable picker (context size, prices per million tokens, tool use, thinking and caching support, credits left), and **Change model…** in the session menu switches a running session. The key stays on the computer: see [the daemon](/en/docs/daemon/#profiles-and-openrouter).

A profile can also run **Codex** (`cx` badge, green): its sessions show the approval policy (`on-request`, `never`…) in place of the mode chip, `exec(…)` and `apply_patch(…)` calls with their output and diff, and approvals with Allow / Deny. See [Codex profiles](/en/docs/daemon/#codex-profiles).

## Settings

- **Machine**: the connection and its path (direct or via relay), the machine's name (an alias of your choice, else its hostname), the daemon version, and **Forget this machine**.
- **Computers**: every paired computer; switch, rename on this device, forget, or add another one.
- **Devices**: the phones and tablets paired with this computer and when each was last seen. **Add device** shows a single-use pairing code (QR and link, valid for 5 minutes) to scan with the other device; **Revoke** disconnects one at once, and it must pair again.
- **Appearance**: System, Dark, Light, Dracula, Catppuccin Mocha and Catppuccin Latte.
- **Profiles**: each profile with its agent, alias, config dir, notifications switch and, with a provider, the provider, the default model and the credits.
- **Notifications**: push for this phone, test, live status, the muted profiles and sessions.
- **Voice**: the transcription language.
- **App**: version, over-the-air updates and their channel, **Check for updates**, **Documentation**.
- **Error reports**: send automatically, ask each time (default) or never, and **Report a problem** (describe the bug, preview exactly what is sent, then send, share or open a GitHub issue). Reports never carry the content of your sessions; see the [privacy policy](/en/docs/privacy/).

## iPad and keyboards

On an iPad (or any wide screen) the list and the conversation sit side by side, and an inspector pane holds the terminal, the subagents and the session details. With a hardware keyboard, ⌘⏎ sends now, Enter sends or inserts a line break according to the composer setting, and the shortcuts are listed in the key hints.
