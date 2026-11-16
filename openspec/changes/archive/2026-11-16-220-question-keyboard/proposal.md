## Why

When an agent asks a question with an "Other…" field, tapping the field opens the keyboard and nothing on screen closes it (#560, iPhone screenshot). On a text question the field is multiline, so Return only adds a line; the only way out is tapping somewhere else, which is not obvious and often lands on an option.

Cause, read in `QuestionCard.tsx`: the field has no `returnKeyType`, `submitBehavior` or `onSubmitEditing`, so the Return key of a single-line field ("Other" of a choice question) does not close the keyboard; a `text` question's field is multiline, where Return inserts a new line; and a `number` question opens the iOS number pad, which has no Return key at all. The keyboard toolbar with its hide-keyboard key (`KeyboardToolbar.tsx`) only shows for the main composer. On top of that the card's scrolling body keeps its 360 pt maximum with the keyboard up, so on a small phone the card, the composer and the keyboard do not fit and the field or the Send button can be pushed out of view.

## What Changes

- The "Other" / answer field gets an OK/Done way out on iOS and Android: single-line fields (choice "Other", number) close the keyboard with their Return key (`returnKeyType="done"`, blur on submit), and while the field is focused a **Done** button next to it hides the keyboard, which covers the multiline text field and the number pad.
- With the keyboard open, the card's scrolling body shrinks to fit the space above the keyboard (a pure `questionBodyHeight` from the window and keyboard heights, with a Vitest test) and scrolls to the field, so the field, Back / Next / Send and Decline stay visible.
- "Done" in pt-BR, en-US and es-ES.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-permissions`: "Question card" (closing the keyboard from the field; field and actions visible with the keyboard open).

## Impact

- App: `features/permissions/components/QuestionCard.tsx`, `features/permissions/interaction.ts` (+ test), the three catalogs.
- No protocol or daemon change.
