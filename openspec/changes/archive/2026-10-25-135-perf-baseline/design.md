## Context

The performance epic (#354) needs before/after numbers on the iPad 9th gen, the Redmi 8 and an iPhone 11. Today the only measurements are the opt-in Firebase traces of change 101, readable only in the Firebase console, and the demo daemon only has screenshot-sized sessions.

## Goals / Non-Goals

**Goals:** a reproducible load (the demo `--perf` sessions) and four numbers that a developer reads on the device itself and pastes into a PR.

**Non-Goals:** native frame metrics (UI thread), automated device runs, any upload of the local numbers.

## Decisions

- **Local numbers always on, in memory.** The stall timer (one 500 ms interval) and a requestAnimationFrame loop that runs only while scroll events arrive are cheap, so they run in every build; Firebase only receives them when the user opted in. Nothing is persisted: each run starts empty, which is what a benchmark run needs.
- **Frames from the JavaScript side.** `conversation_scroll` counts `requestAnimationFrame` deltas while scroll events arrive (stopping 200 ms after the last one). A delta over 1.5 × the 60 Hz frame counts `round(delta / 16.7) - 1` dropped frames. This sees the JavaScript thread, where the epic's hotspots are; UI-thread jank is out of scope (Firebase's automatic slow/frozen frames already cover it when on).
- **Render time from FlashList `onLoad`.** `conversation_ready` is measured from the screen's first render to the list's `onLoad`; when the list is empty at load (entries still on the way) the measurement waits for the first draw with entries (`onContentSizeChange` with items) instead.
- **Demo content generated, not stored.** `demo-perf.ts` builds the entries from a few templates with an index, so the 5,000-entry transcript is deterministic and costs nothing in the repo. The bursty session appends through the same line writer as the initial transcript so parent links stay valid.

## Risks / Trade-offs

- JavaScript-side frame counting misses UI-thread-only jank → stated in the docs; the numbers compare runs of the same build type and device, not absolute smoothness.
- A debug build is much slower than release → the docs ask for release builds for every number in a PR.
