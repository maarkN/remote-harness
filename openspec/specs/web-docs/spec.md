# web-docs Specification

## Purpose
The user documentation served under `/docs/` on remoteharness.app, in three languages, as the only user guide of the app, the daemon and the connection relay.

## Requirements

### Requirement: Documentation pages
The `apps/web` Worker SHALL serve user documentation under `/docs/`, rendered from Markdown pages kept in the repository (`apps/web/content/<locale>/<slug>.md`) with a front matter of `title`, `description` and an optional `applies` version note. The pages SHALL be, in this order: overview (`/docs/`), getting started, using the app, the daemon, cloud server, security & privacy, privacy policy, troubleshooting, contributing. Each page SHALL show a sidebar with the pages, the current page's headings as anchors, previous / next links, and SHALL use the landing's tokens and fonts (dark first, light by system preference). Headings MUST have stable ids so anchors can be linked.

#### Scenario: Open a page
- **WHEN** a visitor opens `/en/docs/getting-started/`
- **THEN** the page renders with its title, its sections, the sidebar marking it as current and links to the previous and next pages

#### Scenario: Version note
- **WHEN** a page's front matter has `applies: 0.7+`
- **THEN** the note "Applies to 0.7+" (translated) is shown under the title

#### Scenario: Privacy policy
- **WHEN** a visitor opens `/pt-br/docs/privacy/`
- **THEN** the privacy policy renders in Portuguese between security & privacy and troubleshooting in the sidebar

### Requirement: Documentation languages
Docs SHALL follow the landing's language model: `/docs/…` negotiates from `Accept-Language` (with `Vary: Accept-Language`), `/en/docs/…`, `/pt-br/docs/…` and `/es/docs/…` are fixed, each page carries the language switcher, `hreflang` alternates and a canonical link. The three languages MUST have the same set of pages; a page missing in a language SHALL be rendered from en-US with a notice saying so.

#### Scenario: Portuguese reader
- **WHEN** a browser with `Accept-Language: pt-BR` opens `/docs/daemon/`
- **THEN** the Portuguese page is returned with `Content-Language: pt-BR`

#### Scenario: Untranslated page
- **WHEN** a language has no file for a slug
- **THEN** the English page is shown with a notice that the translation is pending

### Requirement: Documentation search
Each docs page SHALL offer a search field that filters an embedded index of the current language's sections (page title, heading, text) as the visitor types, listing matching headings as links to their anchors, without calling any service.

#### Scenario: Search a term
- **WHEN** the visitor types "relay" on any docs page
- **THEN** the sections whose heading or text mention it are listed, each linking to its page and anchor

### Requirement: Documentation links and checks
The landing's Docs links, the app's Settings → App → Documentation and the tray's Documentation item SHALL open the docs; the sitemap SHALL list every docs page in every language; the README SHALL point to the docs. A test SHALL render every page in every language and verify that every internal link and anchor resolves.

The docs SHALL be the only user guide. `README.md` SHALL keep what the project is (pitch, screenshots, status, features, how it works), a short security summary, the one-line install, links from each user topic (install per system, pairing, the app, the daemon and its config file, notifications, updates, security, troubleshooting, uninstall) to its docs page, development, contributing and license. `README.pt-BR.md` SHALL follow the same outline in Portuguese, linking `/pt-br/docs/`. Developer-only topics (building and signing the app, Makefile targets, Firebase for self-built apps, the push relay deploy, the connection relay deploy, over-the-air publishing, the website deploy) SHALL live in `CONTRIBUTING.md`. Texts elsewhere (docs pages, landing) MUST NOT send users to the README for a user topic.

#### Scenario: Broken link
- **WHEN** a page links to `/en/docs/missing/` or to an anchor no heading has
- **THEN** the test suite fails naming the page and the link

#### Scenario: Unknown page
- **WHEN** a visitor opens `/docs/nothing-here/`
- **THEN** the branded 404 page is returned

#### Scenario: WSL setup from the README
- **WHEN** a reader looks for the WSL2 notes in the README
- **THEN** they find a link to the getting-started and troubleshooting pages of the docs, not a copy of the notes

#### Scenario: Deploying the push relay
- **WHEN** a contributor looks for how to deploy the push relay
- **THEN** the steps are in `CONTRIBUTING.md`, and the README links there from its development section

#### Scenario: Deploying the connection relay
- **WHEN** a contributor looks for how to deploy the US and Brazil connection relays
- **THEN** `CONTRIBUTING.md` has the `make deploy-relay` and `make deploy-relay-br` steps, the DNS records and the Fly certificate

### Requirement: Privacy policy address
The privacy policy SHALL also be served at `/privacy` (with or without the trailing slash) in the language negotiated from `Accept-Language`, with the same content as `/docs/privacy/` and `https://remoteharness.app/privacy` as its canonical URL, so the stores can link one stable address. The policy SHALL name its publisher (Alvyn Tech) and a privacy contact (`privacy@remoteharness.app`), and SHALL say how to ask for the deletion of the error reports and performance data already sent.

#### Scenario: Store link in Portuguese
- **WHEN** a browser that prefers Portuguese opens `/privacy`
- **THEN** the privacy policy renders in Portuguese with a `Vary: Accept-Language` header and the canonical URL `https://remoteharness.app/privacy`

#### Scenario: No language preference
- **WHEN** a client without `Accept-Language` opens `/privacy/`
- **THEN** the privacy policy renders in English

#### Scenario: Contact
- **WHEN** a visitor reads the policy in any language
- **THEN** it names Alvyn Tech as the publisher and links `privacy@remoteharness.app`

### Requirement: Connection relay self-hosting docs
The daemon page SHALL have a "Self-hosting the connection relay" section, in en-US, pt-BR and es-ES, that says what the relay can and cannot see, how to run its Docker image behind a TLS-terminating proxy (the port, the environment variables for the limits and the client IP header, the health check) and how to point the daemon at it with the `relays` list in the configuration file.

#### Scenario: Run my own relay
- **WHEN** a reader looks for how to self-host the connection relay
- **THEN** the daemon page in their language explains running the image and listing its `wss://` URL in `relays`

### Requirement: Cloud server docs
The docs SHALL have a "Cloud server" page (`/docs/cloud-server/`), in en-US, pt-BR and es-ES, for running the daemon on a cloud VM. It SHALL say that the relay path needs no inbound port, only outbound HTTPS to the connection relays, the push endpoint and the git remote; that the direct path (`wsPort`, 7337) is optional, works on a provider's public IP only when that IP is on an interface of the VM (otherwise over a VPN), and is opened with rules given per provider (AWS, DigitalOcean, Google Cloud, Oracle Cloud, `ufw`), never opening the hooks port; how the daemon keeps running without a login (`loginctl enable-linger`, the systemd user unit, the Secret Service and its `0600` file fallback, no systemd); how the terminal behaves over SSH (`TERM`, a UTF-8 locale, attaching and detaching tmux); and how to troubleshoot unstable connections (the keepalive intervals against NAT and load balancer idle timeouts, updating both sides, the daemon log lines, load balancers), linking #442. The daemon and troubleshooting pages SHALL link to it.

#### Scenario: Port question
- **WHEN** someone setting up a daemon on an AWS instance opens the cloud server page
- **THEN** it says that no inbound rule is needed for the relay path and which security group rule opens the optional direct path
