## Context

`SessionsScreen` (compact width) already animates a shared value `collapsed` (0 → 1) from the scroll direction: the container's height interpolates from the full header's measured height to the compact bar's, the full header fades out and the compact bar (mark, search, filters) fades in. The navigation header (`headerTitle: ListTitle`, settings in `headerRight`) belongs to the native stack and cannot follow a Reanimated value.

## Decisions

- **The list draws its title row on compact width.** The compact route sets `headerShown: false` and `SessionsScreen` adds a title row as the first row of the full header: the mark slot and "Sessions" centered (as the native iOS title was), the settings button on the right, the row 44 pt tall. The `Screen` adds the top safe-area edge in that mode. The row lives inside the existing collapsing container, so it collapses with the rest without new animation code. Regular width keeps its sidebar header and never collapses, as before.
- **One mark, two slots.** The title row and the compact bar get empty slots (22 and 18 pt) where the mark sits; a single `Mark` (22 pt) is drawn absolutely over the header container and its `translateX`/`translateY`/`scale` interpolate with `collapsed` between the two slots. The slots report their positions with `onLayout`; a pure helper (`markTransforms`) turns both slots into the transform of each end, scaling around the glyph's center. Until they are measured the mark uses fallback positions close to the real ones.
- **Reduce Motion** already sets `collapsed` without `withTiming`, so the mark jumps between the slots with no slide.
- **Settings in the compact bar.** An `IconButton` after the filters button, so both actions are reachable while collapsed (new session stays on the floating action button).

## Risks / Trade-offs

- [Losing the native header's behaviors] → the list never used large titles or blur; other screens keep the native header.
- [Layout jump while the heights are measured] → the fallbacks are close to the real sizes and the container height is only animated on compact width, as today.
