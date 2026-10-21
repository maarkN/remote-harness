## 1. Catalogs

- [x] 1.1 `hero.carousel` and `hero.slides` replace `hero.mockLabel`; `mock.conversation` and `mock.live` with the demo text, in en-US, pt-BR and es-ES (same keys)

## 2. Markup and styles

- [x] 2.1 `landing.ts`: phone frame with the scroll-snap track and three slides (session list, conversation, lock screen with two Live Activities), each with its label; hidden controls row (arrows, dots)
- [x] 2.2 `styles.ts`: track and slides, conversation and lock-screen mocks, controls (arrows hidden on coarse pointers), hidden scrollbar

## 3. Script

- [x] 3.1 Dots and arrows, current dot from the scroll position, auto-advance paused on hover/focus and while the page is hidden, off with reduced motion

## 4. Verify

- [x] 4.1 Tests for the rendered markup (three labelled slides, controls hidden until the script runs, the catalog text, script guards); `pnpm check` and `openspec validate --strict`
- [x] 4.2 Look at the page in a browser (desktop and phone width, light and dark)
