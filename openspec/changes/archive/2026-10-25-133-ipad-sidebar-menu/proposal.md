## Why

On an iPad in portrait the session list slides over the conversation from ☰, and right after launch ☰ sometimes does nothing (#346). The overlay unmounts the list when a slide-out finishes, but that callback hops from the UI thread to the JS thread; when it lands after ☰ already opened the list again (easy while the JS thread is busy at launch), the list unmounts with the parent's `open` still `true`. From then on ☰ sets `open` to `true` again, which changes nothing, so the list never comes back until something closes it (rotating, picking a session).

## What Changes

- The overlay sidebar is always rendered while `open` is true (pure `overlayRendered()` in `core/layout`), and a slide-out that finishes late only unmounts the list when it is still closed.
- The tablet sidebar requirement states that ☰ opens the list every time, including the first tap after launch.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `app-shell`: "Edge swipe for the tablet sidebar" gains that ☰ always opens the list and that a finished slide-out never hides a list opened again.

## Impact

`apps/mobile/src/ui/OverlaySidebar.tsx`, `apps/mobile/src/core/layout/sidebar-drag.ts` (+ test). No protocol or daemon change.
