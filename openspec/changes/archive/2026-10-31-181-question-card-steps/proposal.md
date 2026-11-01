## Why

After the first `AskUserQuestion` is answered from the app, the next questions go wrong (issue #473). Reading the code, the daemon's broker handles one question after another correctly (each request has its own id, watch and answer), but the app's card stacks every question of one call inside a 360-point scroll area: with two or more questions, the ones below the first stay out of sight, and Send stays disabled, without a word, until all of them are answered. The user sees "the card does not show the next question" and "Send does nothing". Claude Code's own prompt shows one question at a time.

## What Changes

- **Question card, one question at a time.** The card shows the current question with its options, "Other" or text field, a "Question N of M" line when the call carries several, Back and Next to move between them (Next only once the current one has an answer; answers are kept), and Send on the last one, enabled only when every question has an answer. Decline stays available on every step. Pure helper `stepAt()` in `permissions/interaction.ts`, with tests.
- **i18n**: `progress`, `back` and `next` under `permissions.question` in pt-BR, en-US and es-ES.
- **Daemon regression test**: two questions in a row in the same session are each answered on their own (the first's tool result does not touch the second), documenting the sequence the broker already handles.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-permissions`: the question card shows the questions one at a time with progress, Back and Next; Send on the last.

## Impact

`apps/mobile/src/features/permissions` (`interaction.ts`, `components/QuestionCard.tsx`, tests), the three i18n catalogs, `apps/daemon/test/permissions.test.ts`. No protocol or daemon code change.
