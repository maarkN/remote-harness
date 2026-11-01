## MODIFIED Requirements

### Requirement: App icon
The app SHALL have an icon with the Remote Harness mark (Cursor Signal: a terminal cursor block with the `>` prompt cut out of it and three signal arcs leaving it to the right) in the amber accent, in a 78 % box centered on the flat warm dark `#1C1A17`, with no gradient and no glow, generated from code by `apps/mobile/scripts/icons.mts` together with the splash image, the Android adaptive, themed and notification icons, the favicon and the Live Activity icon. Sizes under 24 px (notification, favicon, Live Activity, menu bar) SHALL use the bold weight of the mark. No asset MAY show the Claude spark or any other agent's symbol. The same script SHALL also generate one flat alternate app icon per theme — background and mark in that theme's colors — for "App icon follows the theme" below.

#### Scenario: iPhone home screen
- **WHEN** the app is installed
- **THEN** the icon shown is the amber Cursor Signal on the flat warm dark

#### Scenario: Android themed icon
- **WHEN** the launcher applies a themed (monochrome) icon
- **THEN** the bold mark is used as the monochrome layer inside the adaptive safe zone

#### Scenario: Regenerating
- **WHEN** a developer runs `pnpm --filter @remote-harness/mobile icons`
- **THEN** every asset in `apps/mobile/assets` (including the per-theme alternate icons) and the brand banner in `docs/brand` are rewritten from the same mark source
