# web-landing Specification

## Purpose
TBD - created by archiving change 68-landing-page. Update Purpose after archive.

## Requirements

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

### Requirement: Language negotiation
The Worker SHALL render the page in pt-BR, en-US or es-ES. `/` SHALL pick the language from `Accept-Language` (q-values honoured; `pt*` → pt-BR, `es*` → es-ES, anything else → en-US) and answer with `Content-Language` and `Vary: Accept-Language`; `/en/`, `/pt-br/` and `/es/` SHALL always answer their language. Every page SHALL carry a language switcher linking to the three paths, `rel="alternate" hreflang` links for the three plus `x-default` pointing at `/`, and a canonical link. The three catalogs MUST have the same keys.

#### Scenario: Portuguese browser
- **WHEN** a browser sends `Accept-Language: pt-BR,pt;q=0.9,en;q=0.8` to `/`
- **THEN** the page comes in pt-BR with `Content-Language: pt-BR`

#### Scenario: Explicit path
- **WHEN** the same browser opens `/es/`
- **THEN** the page comes in es-ES

#### Scenario: Unknown language
- **WHEN** a browser sends `Accept-Language: fr`
- **THEN** the page comes in en-US

### Requirement: Discoverability
Each page SHALL have a translated `<title>` and meta description, Open Graph and Twitter card tags (type, title, description, URL, image `https://remoteharness.app/og.png`, locale), and a favicon (the mark as SVG at `/favicon.svg`, also served at `/favicon.ico`). The Worker SHALL serve the brand image (`docs/brand/og.png`, bundled at build time) at `/og.png`, `/sitemap.xml` listing `/`, `/en/`, `/pt-br/`, `/es/` and every documentation page in every language, and `/robots.txt` allowing everything and naming the sitemap.

#### Scenario: Social preview
- **WHEN** a chat app unfurls `https://remoteharness.app/pt-br/`
- **THEN** it gets the Portuguese title and description and the brand image from `https://remoteharness.app/og.png`

#### Scenario: Sitemap
- **WHEN** a crawler fetches `/sitemap.xml`
- **THEN** it receives XML with the four landing URLs and the docs pages

### Requirement: Install section
The install section SHALL show the install command per operating system in tabs (macOS · Linux with `curl -fsSL https://remoteharness.app/install | bash`, Windows with `irm https://remoteharness.app/install | iex`), each with a copy button, the Windows tab preselected on Windows browsers, the requirements as chips (Node 24+ bundled when missing, tmux, git, ripgrep, `claude` or `codex` on PATH), and the app cards (iPhone & iPad, Android) with the current way to get each build. The Android card SHALL open Google Play's testing page for the app (`https://play.google.com/apps/test/com.alvyntech.remoteharness`) and say it installs from Google Play (testing). When the server has an app install link configured (`APP_INSTALL_URL`), the iPhone & iPad card SHALL open it, say the build installs over the air on registered devices, and be followed by a note linking the docs section that explains how to get a device registered or build from source; without it the card SHALL open the getting started docs and say the app is built from source. The install link MUST come from the server's environment, never from the repository. Both commands MUST be present in the markup so the section works without JavaScript.

#### Scenario: Copy the command
- **WHEN** the visitor taps Copy next to the macOS · Linux command
- **THEN** the command is on the clipboard and the button briefly reads the translated "Copied"

#### Scenario: Windows visitor
- **WHEN** the page is opened from a Windows browser
- **THEN** the Windows tab is selected first

#### Scenario: iPhone install link configured
- **WHEN** the server runs with `APP_INSTALL_URL=/app/<token>/` and a visitor taps the iPhone & iPad card
- **THEN** the install link page opens, and the note under the cards links to the docs on registering a device

#### Scenario: No install link
- **WHEN** the server runs without `APP_INSTALL_URL` (or with a value that is neither a path on the site nor an https URL)
- **THEN** the iPhone & iPad card opens the getting started docs and reads "Build from source"

#### Scenario: Android from Google Play
- **WHEN** a visitor taps the Android card
- **THEN** Google Play's testing page for `com.alvyntech.remoteharness` opens, and the card reads "Google Play (testing)" in the page's language

### Requirement: Other paths
The Worker SHALL answer `/api/updates/*` as the updates server and the app install link as their requirements say, SHALL answer `/install`, `/install.sh` and `/install.ps1` as the installer URLs require, and SHALL answer every other path with a small branded 404 page in the negotiated language that links to the landing and the repository.

#### Scenario: Old redirect path
- **WHEN** someone opens `/anything-else`
- **THEN** a 404 page in their language is returned, with links home and to GitHub

#### Scenario: Installer through the Worker
- **WHEN** `curl -fsSL https://remoteharness.app/install.sh` reaches the Worker
- **THEN** it receives the bundled `install.sh` as `text/plain`, without a redirect

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

### Requirement: Works with strip
Under the hero, the "Works with" strip SHALL show one chip per agent or provider, each with its mark, in this order: Claude Code, Codex CLI, Gemini CLI, Kimi, Qwen Code, OpenRouter models. Every agent chip SHALL be shown as available, with no "soon" tag; OpenRouter SHALL carry a translated "via profiles" note. Every text on the page that says which agents are supported (FAQ, how it works, requirements, docs) SHALL agree with the strip in the three languages.

#### Scenario: Codex is supported
- **WHEN** a visitor looks at the "Works with" strip
- **THEN** Codex CLI is the second chip, styled like Claude Code and without the "soon" tag

#### Scenario: Gemini is supported
- **WHEN** a visitor looks at the "Works with" strip
- **THEN** Gemini CLI is the third chip, styled like Claude Code and without the "soon" tag

#### Scenario: Kimi is supported
- **WHEN** a visitor looks at the "Works with" strip
- **THEN** Kimi is the fourth chip, styled like Claude Code and without the "soon" tag

#### Scenario: Agents still coming
- **WHEN** a visitor looks at the "Works with" strip
- **THEN** no agent chip is dimmed or tagged "soon"

#### Scenario: Qwen Code is supported
- **WHEN** a visitor looks at the "Works with" strip
- **THEN** Qwen Code is the fifth chip, styled like Claude Code and without the "soon" tag, and OpenRouter comes last with "via profiles"

#### Scenario: FAQ agrees
- **WHEN** a visitor opens "Which agents are supported?" in any language
- **THEN** the answer names Claude Code, Codex CLI, Gemini CLI, Kimi CLI and Qwen Code as supported and no agent as planned

### Requirement: Device registration docs
The getting started docs SHALL explain, in the three languages, that the over-the-air iPhone & iPad build is ad-hoc and installs only on devices registered in the developer team, how to find a device's UDID, that it is sent privately to the maintainer (never in a public issue), and that building from source with one's own developer account has no such list. The install link page's registration hint SHALL link to that section.

#### Scenario: Unregistered iPhone
- **WHEN** a visitor reads the install link page on an iPhone that is not registered
- **THEN** the hint links to the docs section that explains how to get the device added

### Requirement: Footer layout
The footer shared by the landing, docs and install pages SHALL show, top to bottom: the brand with the links row, the contributors, the trademark and non-affiliation notice spanning the full width of the site container (on desktop and mobile), and the "Made by" line.

#### Scenario: Desktop footer
- **WHEN** a visitor scrolls to the footer of the landing on a desktop browser
- **THEN** the trademark notice sits below the contributors and runs the full width of the content, above "Made by"

#### Scenario: Docs footer
- **WHEN** a visitor reaches the footer of a docs page
- **THEN** it has the same order and full-width notice as the landing
