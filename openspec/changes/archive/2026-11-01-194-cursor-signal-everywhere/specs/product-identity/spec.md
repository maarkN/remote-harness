## MODIFIED Requirements

### Requirement: Brand mark
The product mark SHALL be "Cursor Signal": a terminal cursor block with the `>` prompt cut out of it and three signal arcs leaving it to the right, drawn in a 256 box (the block 62 × 104 at (34, 76) with a corner radius of 13, the prompt cut out by a 16-unit round stroke; the arcs concentric on the block's right edge (96, 128) with radii 36, 76 and 116, spanning ±40°, stroke 22), in the amber accent, in two weights: regular for the app icon, splash, README and web; bold under 24 px (menu bar, notification icon, favicon, Live Activity, Linux tray), with a wider cutout and thicker arcs so neither closes up. The mark SHALL be defined once in `apps/mobile/scripts/icons.mts` and every brand asset SHALL be generated from it: the app assets, the brand banner `docs/brand/og.png` (1200×630, mark, product name, tagline and agent chips, in JetBrains Mono) used as the README header, the Linux tray icon (a symbolic SVG of the bold mark) and the Google Play feature graphic; the designer's SVG sources (amber on warm dark, inverted, light and mono) SHALL be kept under `docs/design/identity/branding/`. The copies drawn by hand SHALL use the same geometry: the sessions list header mark in the app, the site's inline marks and its favicon (the bold mark in a 78 % box on `#1C1A17` with 22 % corners), the macOS menu bar glyph and the Windows notification-area icon (the bold mark as a template image at 18 pt / the small icon size). Those two tray glyphs SHALL encode the state in shape and opacity, never in color but the amber dot: `idle` the plain mark; `working` the block filled solid, the prompt gone like a busy cursor; `waiting` the amber dot over the outer arc's upper end; `offline` the mark at 40 % opacity. The installer, setup and doctor banners SHALL draw the mark in block characters (the block with the prompt cut out and the three arcs) next to the words REMOTE / HARNESS, in the amber accent, and MUST fit an 80-column terminal. No brand asset MAY show the Claude spark. No generated asset MAY draw a glow, shadow or gradient behind the mark on the icon: the app icon SHALL be the mark in a 78 % box centered on the flat warm dark `#1C1A17`, and the favicon, the Live Activity icon, the brand banner and the Google Play feature graphic SHALL render a flat background plus the mark, nothing else. The brand banner's agent chips SHALL show a small drawn glyph for each agent instead of a two-letter code, and its tagline and chip labels SHALL stay legible at the README's 720 px display width.

#### Scenario: macOS menu bar
- **WHEN** the daemon's tray helper runs on macOS with no session working
- **THEN** the status item shows the bold Cursor Signal as a template image, tinted by the system for light and dark menu bars; while a session works the block is solid, while one waits an amber dot sits over the outer arc, and with the daemon offline the glyph is drawn at 40 %

#### Scenario: Windows notification area
- **WHEN** the daemon's tray helper runs on Windows
- **THEN** the small icon is the bold Cursor Signal in black on a light taskbar and white on a dark one, with the same four states as the menu bar

#### Scenario: App header and site
- **WHEN** the sessions list, the landing page, the install link page or the browser tab shows the mark
- **THEN** it is the Cursor Signal drawn from the same geometry as the generated assets, the favicon on the flat warm dark with rounded corners

#### Scenario: Setup banner
- **WHEN** the setup wizard starts in an 80-column terminal
- **THEN** it prints the block-character Cursor Signal next to REMOTE / HARNESS, in amber, every line within 80 columns

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
