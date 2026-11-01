## Context

Two code paths name a session: `extractMeta` reads a transcript (resume, restart, recent scan) with the precedence name > first prompt > first command > last prompt > folder; `SessionService.handleHook` names a live session from `SessionStart` (transcript summary, empty for a new session) and `UserPromptSubmit`, where "still untitled" meant "title equals the folder name or is raw markup". Once a command had named the session, no later prompt could.

## Decisions

- **Remember the title's source, not more state.** `SessionService` keeps a `Map<sessionId, TitleSource>` (`folder` < `command` < `prompt` < `custom`); a candidate replaces the title only when its source ranks higher, so the first prompt and the first command stay, as in `extractMeta`. Sessions the service did not title (a name from `session.start`, a restored link) get their source read off the title: the folder name or markup are `folder`, anything else is `prompt`. The map is memory only: after a restart `restore()` reads the summary, which now carries the source.
- **`extractMeta` reports the source** (`titleSource` on `TranscriptMeta` and, optionally, `TranscriptSummary`), so `SessionStart` and `restore()` know whether the transcript's title was a name, a prompt or a command. Other agents' adapters leave it absent (`prompt` is assumed).
- **Raw commands.** Hook payloads carry the prompt as typed; `isCommandPrompt` also accepts `/…` and `!…` at the start of the text.
- **Names through the service.** The transcript feature hands a `custom-title` to `SessionService.setCustomTitle`, which records `custom` and patches the title; the backlog read when a stream opens applies its latest name too (status was already applied this way). `/rename <name>` in a hook sets the name at once, without waiting for the transcript line.

## Risks / Trade-offs

- [A user prompt that starts with `/` or `!` is taken as a command] → Claude Code treats such input as a command anyway; the title is still shown, it just gives way to the next plain prompt.
- [The source map is lost on restart] → `restore()` rebuilds it from the transcript summary.
