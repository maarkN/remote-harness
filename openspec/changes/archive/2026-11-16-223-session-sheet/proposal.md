## Why

The session's More options menu (⋮) is a long list of text buttons, up to 11 of them: the native `ActionSheetIOS` on iOS, which takes the whole screen, and a custom dropdown on Android, both without icons. Tapping the session title opens a separate details sheet instead (#563, iPhone screenshots). The actions and the details of one session live in two places, and neither scans well.

Also from the code: there is no shared bottom sheet in `src/ui`; every sheet builds its own `<Modal transparent animationType="slide">` with its backdrop, safe-area padding and rounded top.

## What Changes

- A **session sheet**, WhatsApp-like, opened both by tapping the session title (or the folder under the header, or the status line's details) and by the ⋮ button (kept for now, to be removed in a later change): the session summary on top (agent badge, title, profile, folder, state), the actions as a **grid of icon buttons** with a short label under each (Terminal, Command, Model, Subagents, Key bar, Hands-free, Templates, Schedule, History, Changes, Follow, Live status, as today depending on the session and the computer), then the session details (the same rows as the tablet inspector), and **Close session** set apart at the bottom in the danger color.
- Every current menu item stays reachable and keeps its rules: in a read-only session the same items are disabled and the sheet says why; toggles (key bar, hands-free, follow output, live status) show their state as a highlighted cell and are announced by the action they take.
- Keyboard: ⌘⇧O opens the sheet; ↑ / ↓ move between its enabled actions, Enter chooses, Esc closes (on iOS and Android alike, since the sheet is drawn by the app).
- A shared **`ui/Sheet`** (modal bottom sheet: dimmed backdrop that closes it, Android back, safe area, rounded top, a header with a close button, centered and at most 560 pt wide on tablets), used by the session sheet. The old details sheet and `ActionMenu` go away.
- Icons from lucide, colors from theme tokens, texts in pt-BR, en-US and es-ES, accessible labels per action.
- Pure layout (`sessionSheet`: the grid cells with their short label and toggle state, and Close session apart) with Vitest tests.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-conversation`: "Session options menu" (a sheet with an icon grid, opened from the title too) and "Session details" (they are now a section of that sheet).
- `app-shell`: "Hardware keyboard shortcuts" (⌘⇧O and the arrow keys apply to the session sheet on both platforms).

## Impact

- App: new `ui/Sheet.tsx`, new `features/sessions/components/SessionSheet.tsx`, `features/conversation/session-menu.ts` (+ test), `app/(main)/session/[id]/index.tsx`, `features/sessions/components/SessionDetailsSheet.tsx` and `ui/ActionMenu.tsx` removed, the three catalogs.
- No protocol or daemon change.
