## MODIFIED Requirements

### Requirement: Brand mark
The product mark SHALL be "Cursor Signal": a terminal cursor block with the `>` prompt cut out of it and three signal arcs leaving it to the right, drawn in a 256 box (the block 62 × 104 at (34, 76) with a corner radius of 13, the prompt cut out by a 16-unit round stroke; the arcs concentric on the block's right edge (96, 128) with radii 36, 76 and 116, spanning ±40°, stroke 22), in the amber accent, in two weights: regular for the app icon, splash, README and web; bold under 24 px (menu bar, notification icon, favicon, Live Activity, Linux tray), with a wider cutout and thicker arcs so neither closes up. The mark SHALL be defined once in `apps/mobile/scripts/icons.mts` and every brand asset SHALL be generated from it: the app assets, the brand banner `docs/brand/og.png` (1200×630, mark, product name, tagline and agent chips, in JetBrains Mono) used as the README header, the Linux tray icon (a symbolic SVG of the bold mark) and the Google Play feature graphic; the designer's SVG sources (amber on warm dark, inverted, light and mono) SHALL be kept under `docs/design/identity/branding/`. The macOS menu bar glyph (a template image drawn from the bold mark), the Windows tray glyph, the app header mark, the site favicon and the installer banner SHALL draw the same geometry. The installer and setup banner SHALL draw the mark in block characters next to the words REMOTE / HARNESS, in the amber accent, and MUST fit an 80-column terminal. No brand asset MAY show the Claude spark. No generated asset MAY draw a glow, shadow or gradient behind the mark on the icon: the app icon SHALL be the mark in a 78 % box centered on the flat warm dark `#1C1A17`, and the favicon, the Live Activity icon, the brand banner and the Google Play feature graphic SHALL render a flat background plus the mark, nothing else. The brand banner's agent chips SHALL show a small drawn glyph for each agent instead of a two-letter code, and its tagline and chip labels SHALL stay legible at the README's 720 px display width.

#### Scenario: macOS menu bar
- **WHEN** the daemon's tray helper runs on macOS
- **THEN** the status item shows the bold mark as a template image, tinted by the system for light and dark menu bars

#### Scenario: Setup banner
- **WHEN** the setup wizard starts in an 80-column terminal
- **THEN** it prints the block-character mark next to REMOTE / HARNESS, in amber

#### Scenario: README header
- **WHEN** the repository README is opened on GitHub
- **THEN** its header is the brand banner with the mark, the name and the agent chips, with no glow behind the mark and legible tagline and chip text at 720 px wide

#### Scenario: App icon at small sizes
- **WHEN** the app icon is rendered at 29pt, 40pt or 60pt, or inside the Android adaptive icon mask
- **THEN** only the flat background and the mark are visible, with no glow softening its edges

#### Scenario: Prompt cutout under 24 px
- **WHEN** the notification icon (24 dp), the favicon (16 and 32 px), the Live Activity icon (48 pt) and the Linux symbolic icon (22 px) are rendered
- **THEN** they use the bold weight and the `>` cut out of the block stays visible

#### Scenario: Regenerating from the sources
- **WHEN** a developer runs `pnpm --filter @remote-harness/mobile icons`
- **THEN** every asset is rewritten from the Cursor Signal geometry and no PNG is edited by hand
