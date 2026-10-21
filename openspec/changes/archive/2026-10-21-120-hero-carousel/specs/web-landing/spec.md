## MODIFIED Requirements

### Requirement: Landing page
`https://remoteharness.app/` SHALL serve a landing page rendered by the `apps/web` Worker, in the product identity (dark terminal theme first, light when the visitor's system prefers it, amber accent, JetBrains Mono for headings and UI text, IBM Plex Sans for running text), with these sections in order: hero (one-line pitch, lead, "Install on your machine" and "Get the app" calls to action, platform line, app carousel), "Works with" agents strip, how it works (phone · machine · agents in tmux, three steps), features, privacy & security, install, docs & FAQ, and a footer with links (docs, GitHub, releases, security, privacy policy, license) and the trademark note. The page MUST be responsive from phone width up, keyboard-navigable with visible focus, and MUST NOT load scripts, pixels or analytics from third parties (fonts from Google Fonts are the only external resource).

#### Scenario: First visit
- **WHEN** a visitor opens `https://remoteharness.app/`
- **THEN** the landing page is returned with status 200, `text/html; charset=utf-8` and the sections above

#### Scenario: Light system theme
- **WHEN** the visitor's system prefers a light color scheme
- **THEN** the page renders with the light tokens without any switch

#### Scenario: Privacy link
- **WHEN** the visitor looks at the footer
- **THEN** a Privacy link opens the privacy policy page in the page's language

## ADDED Requirements

### Requirement: Hero carousel
The hero SHALL show one phone frame with three slides, in order: the session list (waiting card with Deny / Always / Allow, filters, rows), a session's conversation (context line, user prompt, assistant reply with inline code and a list, tool calls with results, composer), and the Live Status on the lock screen (a working session and one waiting for a permission). The slides SHALL scroll horizontally with snap points so they can be swiped on touch devices and are reachable without JavaScript, with the first slide visible first. When the script runs it SHALL show one dot per slide and previous / next arrows (not on coarse pointers), mark the current dot, and advance automatically, pausing while the pointer is over the carousel or focus is inside it; auto-advance MUST NOT run when the visitor prefers reduced motion. Each slide SHALL have an accessible label, and all mock text SHALL come from the catalogs (same keys in the three languages) and show demo content only.

#### Scenario: Swipe on a phone
- **WHEN** a visitor on a touch device swipes the hero phone to the left
- **THEN** the conversation slide snaps into place and the second dot is marked current

#### Scenario: Reduced motion
- **WHEN** the visitor's system prefers reduced motion
- **THEN** the carousel stays on the slide the visitor chose and never advances by itself

#### Scenario: No JavaScript
- **WHEN** the page is opened with scripts disabled
- **THEN** the session list slide is visible, the other slides can be scrolled into view, and no inert controls are shown

#### Scenario: Pause on focus
- **WHEN** keyboard focus moves into the carousel
- **THEN** auto-advance stops until focus leaves it
