## Why

Issue #306: the trademark / non-affiliation notice sits in the footer's left column, next to the contributors, as a narrow block (`max-width: 72ch`), which makes the footer look unbalanced and the notice hard to read.

## What Changes

- Footer order: brand + links row → contributors → trademark notice spanning the full content width → "Made by …".
- The `.fine` wrapper goes away; the notice is a `small.legal` block at full width on desktop and mobile.
- The docs and install pages share `siteFooter()`, so they change the same way.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-landing`: the footer's order and the notice's width.

## Impact

`apps/web/src/landing.ts` (`siteFooter`), `styles.ts`, `apps/web/test/landing.test.ts`. No catalog changes.
