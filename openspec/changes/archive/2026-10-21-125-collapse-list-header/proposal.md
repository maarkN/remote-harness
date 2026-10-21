## Why

On a phone, scrolling the session list down collapses the machine line, the filter chips and the search into the compact bar (mark, search, filters button), but the navigation header above it — the mark, "Sessions" and the settings button — stays. The screen ends up with two rows carrying the mark and less room for the list (issue #307).

## What Changes

- On compact width the session list draws its own title row (mark, "Sessions", settings) inside the collapsing header instead of using the stack's navigation header, so the title row collapses together with the machine line and the filters, on the UI thread, and comes back with them on scroll up or at the top.
- The mark is a single glyph that slides (and shrinks from 22 to 18 pt) from the title row into the compact bar's mark slot, instead of the compact bar fading in a mark of its own; scrolling up slides it back.
- With Reduce Motion on, the header switches between the two layouts without the slide.
- The compact bar gains the settings button; the new-session floating action button is unchanged, so both actions stay reachable while collapsed.
- The top safe area is kept by the list screen itself; regular width (iPad sidebar) is unchanged.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `app-session-list`: "Header and machine line" (compact title row drawn by the list) and "Collapsing header on scroll" (title row collapses too, sliding mark, settings in the compact bar).

## Impact

- `apps/mobile/src/app/(main)/index.tsx`: the compact list route hides the stack header.
- `apps/mobile/src/features/sessions/SessionsScreen.tsx`: title row, sliding mark, settings in the compact bar, top safe area.
- `apps/mobile/src/features/sessions/collapse.ts` (pure, tested): mark transforms for both layouts.
- No new strings (reuses `sessions.title`, `nav.settings`).
