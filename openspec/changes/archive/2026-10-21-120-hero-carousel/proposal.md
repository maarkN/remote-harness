## Why

Issue #303: the landing hero shows a single static phone mock, the session list. Visitors never see the two other screens that sell the app: a session's conversation and the Live Status on the lock screen.

## What Changes

- The hero phone becomes a carousel with three slides inside the same phone frame:
  1. **Sessions**: the current list mock (waiting card with Deny / Always / Allow, filters, rows).
  2. **Conversation**: a session's detail (header, context line with profile, folder, state, mode, model and context use, a user prompt, an assistant reply with inline code and a list, tool calls with their results, the composer).
  3. **Live Status**: the lock screen with two Live Activities, one working session (current step, tool count, elapsed time) and one waiting for a permission (Deny / Allow).
- Controls under the phone: previous / next arrows (desktop) and one dot per slide; swipe comes from native horizontal scroll with scroll-snap on touch devices.
- Auto-advance every few seconds, paused while the pointer is over the carousel or focus is inside it, and off with `prefers-reduced-motion: reduce`.
- Without JavaScript the slides stay a horizontally scrollable, snap-aligned strip (first slide visible); the controls are only shown when the script runs.
- Every slide has an accessible label; all mock text comes from the three catalogs (same keys). Demo content only.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-landing`: the hero shows the app carousel instead of a single session-list mock.

## Impact

`apps/web/src/landing.ts` (hero, carousel markup, script), `styles.ts` (slides, conversation and lock-screen mocks, controls), the three catalogs (`hero` slide labels and controls, `mock.conversation`, `mock.live`), `apps/web/test/landing.test.ts`. No server or route changes.
