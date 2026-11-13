## Why

On iPhone, wide content in the conversation is cut at the right edge and nothing shows that it scrolls sideways (#544; iOS 26.5 simulator, iPhone 17 Pro Max, worse on smaller phones):

- **Markdown tables**: a three-column table shows only two columns. `Markdown.tsx` does not override react-native-marked's `table` renderer, which puts the table in a horizontal `ScrollView` and gives every column 43% of the window width (`getTableWidthArr`), so three columns take 130% of the screen whatever their content.
- **Tool output**: in the Output tab of Task, WebFetch and Grep cards long lines are cut. `LongText` in `ToolCallCard.tsx` puts every output in a horizontal `ScrollView` and never wraps it, prose included.
- **Code blocks** scroll sideways too, which is right for code, with no hint either.

## What Changes

- Markdown tables get their own renderer: each column's width comes from its longest cell (the conversation font is monospaced, so characters × advance width is exact enough), clamped between a minimum and a maximum that follows the window width; longer cells wrap inside their column. A short three- or four-column table fits an iPhone SE. The table gets the code blocks' background and border.
- Tool output wraps when it is prose and keeps its lines when its columns matter: a fixed table of tools keeps the sideways scroll (`Bash`, `BashOutput`, `Grep`, `Glob`, `Read`, `LS`, `NotebookRead`, Codex's `exec` and `apply_patch`); every other tool's output (Task / Agent, WebFetch, WebSearch, MCP tools, edits' confirmations) wraps. The JSON tab keeps its lines.
- A `SideScroll` component in the design system replaces the bare horizontal `ScrollView` of tables, code blocks and column output: while its content runs past the right edge it shows a fade there (from transparent to the block's own background, so it matches any screen), and it flashes the scroll indicator the first time the content overflows.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-conversation`: "Entry rendering" sizes table columns from their content and requires a visible hint on sideways-scrolling content; "Tool call details" wraps prose output and keeps column output scrolling.

## Impact

- App: `src/ui/SideScroll.tsx` (+ pure overflow helper with tests), `features/conversation/components/Markdown.tsx` (table renderer, code block), `features/conversation/components/ToolCallCard.tsx` (`LongText`), pure helpers for table widths and output wrapping with tests. No daemon, protocol or text change.
