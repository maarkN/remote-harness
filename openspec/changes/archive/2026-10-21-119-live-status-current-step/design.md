## Context

Live status pushes go through FCM to APNs (Live Activity `content-state`) or to the Android app as data messages. The project rule is that pushes never carry session content, with one exception: the live status carries the session title and folder. Issue #312 asks to show the tool and a short target, and to review whether that is acceptable or should be opt-in.

## Decisions

### Sanitized target, always on (no opt-in)

The full tool input (a command line, a file path, a search pattern, a URL) can hold secrets or private text; it never leaves the daemon. What does leave is a target picked by a fixed, tested table:

| Tool | Target |
| --- | --- |
| `Read`, `Edit`, `MultiEdit`, `Write`, `NotebookEdit` | base name of `file_path` / `notebook_path` (no directories) |
| `Bash` | the program of the first command (env assignments and `sudo`/`env`/`time`/`nohup`/`exec`/`command` wrappers and `cd …` segments skipped, path stripped), plus its subcommand when the program is in a short list (`git`, `pnpm`, `npm`, `yarn`, `bun`, `npx`, `pnpx`, `bunx`, `cargo`, `go`, `make`, `docker`, `gh`, `kubectl`, `turbo`, `uv`, `pip`, `brew`) and the next word is a plain lowercase word (`^[a-z][a-z0-9._-]{0,23}$`) |
| `WebFetch` | the URL's host name |
| `Task`, `Agent` | `subagent_type` when it is a plain identifier |
| anything else (`Grep`, `Glob`, `WebSearch`, MCP tools, …) | none |

Targets are at most 40 characters. A file's base name and a program name reveal about as much as the folder the live status already shows, and they are what makes the status useful, so an opt-in (off by default) would hide the feature for little gain. Rejected: sending `command`/`description` verbatim (secrets in command lines), or an opt-in setting with full targets (more plumbing, and the risky part would still be one toggle away).

### Progress from the todo list

- `TodoWrite` carries the whole list: `progress = { done: completed, total }`.
- Newer Claude Code versions use `TaskCreate` (one new task) and `TaskUpdate` (`taskId`, `status`): `TaskCreate` adds one to `total`; `TaskUpdate` to `completed` adds one to `done` once per `taskId`; to `deleted` removes one from `total` (and from `done` if it was completed). An update with no known list (total 0) is ignored.
- `progress` is `null` while there is no list or `total` is 0, and `done` is clamped to `total`.
- A new prompt keeps an unfinished list and drops a finished one, so a turn that continues a plan shows it and the next unrelated turn doesn't show "7/7".

### Subagents and background tasks apart

`LiveStatus.tasks` becomes `{ subagents, background }`; the props' `tasks` text joins the non-zero parts ("2 subagents · 1 background task"). The `tasks` prop stays a string, so the protocol doesn't change for it.

### Static progress only

Widgets don't animate an indeterminate `ProgressView`, so it is removed. A determinate `ProgressView(value: done/total)` shows only while working with a list; the ticking timer remains the sign of life.

### Payload size

APNs caps a Live Activity push at 4 KB. The new fields add at most ~70 bytes (`current` ≤ 40 + tool name, `progress` two numbers). A test builds the iOS message for a worst-case update (long title, folder and session name, five recent lines, five glyphs, pending request, palette, current, progress) and checks the APNs payload stays under 4096 bytes.

## Risks

- The `TaskCreate`/`TaskUpdate` input shape is Claude Code's internal format: parsing is defensive (unknown shapes are ignored, never thrown on), and the feature degrades to "no progress".
- Program names can be odd for unusual commands (`bash -c '…'` shows `bash`); that is acceptable, the target is a hint, not the command.
