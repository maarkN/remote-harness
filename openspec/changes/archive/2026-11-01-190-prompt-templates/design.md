## Context

The composer's draft lives in `features/drafts` (a Zustand store persisted per session in SecureStore, this device only). Device-wide preferences follow the same pattern: a store, a `restore…()` called once from the root layout, SecureStore writes. The New session screen has a First prompt field since #430, and the session route owns the sheets reachable from the options menu (`sessionMenu` builds the items; the keyboard toolbar shows the `@` and `/` trigger buttons while the field is focused). See proposal.md for the motivation.

## Goals / Non-Goals

- Goals: templates that survive relaunches and forgetting a computer; placeholders that need no typing when the app knows the value; one picker used by the conversation and by New session; no new dependency.
- Non-goals: sync between devices (#420), templates with photos, a `/` autocomplete section (the `/` list is the agent's commands; a `{}` button keeps the two apart), sharing templates with the daemon or other users.

## Decisions

- **One SecureStore item per template plus an index**, as the drafts do, with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: the texts are prompts the user wrote. One item per template keeps each value small and lets a corrupt item be dropped alone; the index is rewritten after every change. Writes are chained so they land in order. Alternative rejected: the encrypted history database, which is per computer and wiped when the computer is forgotten.
- **8 000 characters, 60 for the title.** A template usually becomes a first prompt, capped at 8 KB on the daemon side (#430); a longer text is pasted from the conversation anyway. The limit is checked in the editor (Save disabled with the limit shown), so nothing is cut silently.
- **Placeholders are `{name}`**, filled from a small built-in set (`branch`, `folder`, `cwd`, `date`) and otherwise asked. The form appears only when a value is missing, so the common case (branch known) is one tap. A blank value keeps `{name}` in the text instead of deleting it: a hole the user sees beats a sentence that silently lost a word.
- **The picker inserts; it never sends.** Appending to the draft (blank-line separated, the same helper "Add to prompt" uses) keeps the user in control and works with the queue, attachments and voice as any typed text does.
- **Editor as a form, not a second modal.** The picker is a modal; its "Save the prompt as a template" and "Create one" switch the sheet to an inline editor form instead of stacking a modal on a modal (fragile on iOS). The management screen wraps the same form in its own sheet.
- **Entry points**: the session menu item (disabled in read-only sessions, like everything that types into the pane) and a `{}` trigger button in the keyboard toolbar, next to `@` and `/`, for the moment the user is already typing.
- **Local ids** from time and randomness in the characters SecureStore keys accept; no crypto needed for a per-device list.

## Risks / Trade-offs

- [SecureStore values over 2 KB warn on some platforms] → same exposure as the drafts, which keep whole prompts there; one item per template keeps most values small.
- [A template text that looks like a placeholder, e.g. JSON `{key}`] → `{name}` only matches an identifier without spaces or quotes, and an unfilled one stays as typed; the user sees the form and can leave it blank.
- [Templates are not backed up] → stated in the hint of the settings card; sync comes with accounts (#420).
