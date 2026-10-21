## Context

`hero()` in `apps/web/src/landing.ts` renders `phoneMock()`: one `.phone` frame (`role="img"`, its app content `aria-hidden`) zoomed to 0.62 (0.5 on narrow screens). The page ships one small inline script (`SCRIPT`) for the install tabs and copy buttons and must keep working without it. No third-party scripts are allowed.

## Decisions

- **One phone frame, a scroll-snap track inside it.** The frame keeps its notch and home indicator; the status bar moves into each slide (the lock screen draws its own). The track is `overflow-x: auto` with `scroll-snap-type: x mandatory` and each slide is `flex: 0 0 100%`. Touch swipe, trackpad scroll and keyboard arrows (the track is focusable, `tabindex="0"`) all work with no script, which also covers the no-JavaScript case: the first slide is what shows, the others are a swipe away. The scrollbar is hidden.
- **Controls live outside the zoomed frame** (so they keep their real size) in a `.cnav` row that is rendered `hidden` and un-hidden by the script, since arrows and dots that do nothing would be worse than none. Arrows are hidden on coarse pointers (`@media (pointer: coarse)`), dots stay everywhere.
- **Script**: dots and arrows call `track.scrollTo({ left: index * clientWidth })` (smooth unless reduced motion); a `scroll` listener derives the current index from `scrollLeft / clientWidth` and marks the active dot with `aria-current="true"`. Auto-advance (6 s, wraps to the first slide) runs only when `matchMedia('(prefers-reduced-motion: reduce)')` does not match, and pauses on `mouseenter` / `focusin` and resumes on `mouseleave` / `focusout`; it also stops while the page is hidden.
- **Accessibility**: the carousel is a `<div role="region" aria-roledescription="carousel" aria-label=…>`; each slide is `role="img"` with its own translated label (the mock's text is decorative and `aria-hidden`, as today). Dots are buttons labelled with the slide name.
- **Catalog shape**: `hero.mockLabel` becomes `hero.carousel` (region label, previous, next) plus `hero.slides` (three `{ name, label }`); the conversation and lock screen text go under `mock.conversation` and `mock.live`. The assistant reply uses the existing inline markup (`code`) plus a short bullet list, rendered with `inline()`.
- **Styles** reuse the app tokens already scoped to `.phone` (`--a-*`). New class names are prefixed or scoped (`.conv`, `.umsg`, `.amsg`, `.tcall`, `.lock`, `.la`) so they do not collide with the landing's own `.tool`/`.cmd` rules.

## Risks / Trade-offs

- [`zoom` on the frame and `scrollLeft` in the same coordinate space] → the index is computed from the track's own `clientWidth`, so the zoom factor cancels out.
- [Auto-advance can be distracting] → slow interval, pauses on hover/focus, disabled for reduced motion and when the tab is hidden.
