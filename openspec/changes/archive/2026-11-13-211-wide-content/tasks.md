## 1. Pure logic

- [x] 1.1 `tableColumnWidths` (cell texts → widths, clamped, monospaced advance) with Vitest tests, including a short three-column table that fits an iPhone SE content width and a long cell clamped to the maximum; verify the tests pass
- [x] 1.2 `outputWraps(toolName)` (column tools keep the scroll, others wrap) and the `SideScroll` overflow helper (`hasMoreRight`), with Vitest tests; verify the tests pass

## 2. Components

- [x] 2.1 `SideScroll` in `src/ui`: horizontal scroll with the right-edge fade (theme colors via `react-native-svg`) while content lies beyond, and the indicator flashed when it first overflows; verify typecheck and Biome pass
- [x] 2.2 `Markdown.tsx`: table renderer with the content-sized columns in a `SideScroll`, code blocks in a `SideScroll`; `ToolCallCard.tsx`: prose output wraps, column output and JSON in a `SideScroll`; verify typecheck, Biome and the React Compiler report (no new skipped functions)

## 3. Verification

- [x] 3.1 `pnpm check` green
- [ ] 3.2 On the iOS simulator, iPhone (compact width) and iPad: the demo's three-column table fits, a wide table and a code block show the fade, Task / WebFetch output wraps, Bash / Grep output scrolls with the fade
