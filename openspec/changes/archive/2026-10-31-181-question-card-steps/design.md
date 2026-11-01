## Context

`AskUserQuestion` often carries two to four questions in one call, each with options and descriptions. The app's `QuestionCard` renders all of them in one scroll area capped at 360 points (the card sits in the conversation's footer, above the composer), and Send is disabled until every question has an answer. On a phone the first question fills the area; nothing says more questions follow. Claude Code's terminal prompt shows one question at a time with tabs and a final Submit.

The daemon side was checked for the sequential case (two calls): each `PermissionRequest` hook gets its own request, watch and `permission.resolved`; a question's tool result is written to the transcript before the agent asks the next one, and `TranscriptService.follow` drains the file before adding a new listener, so the first answer cannot settle the second request.

## Goals / Non-Goals

**Goals:** every question of a call is shown and answered from the phone; the user always knows how many are left; the daemon's handling of consecutive questions is covered by a test.

**Non-Goals:** changing the protocol (`permission.answer` still carries all answers at once), auto-advancing after a pick, settling a question only on its own tool result (the "any tool result" rule from #437 stays).

## Decisions

- **One question per step, explicit Next.** Auto-advance after a single-choice pick (as the terminal does) would fight the "Other" text field; Next is enabled once the current question has an answer, Back is always there, answers survive moving. Send appears on the last step only and keeps the rule "enabled only when every question has an answer".
- **`stepAt(questions, selections, step)`** returns the question at a clamped step, whether it has an answer, whether it is the last and whether all are answered; the card only renders what it says, so the logic is tested without React Native.
- **Progress line** "Question N of M" only when M > 1; one question keeps today's look.
- **Keep the scroll area** for a single long question (many options with descriptions).
