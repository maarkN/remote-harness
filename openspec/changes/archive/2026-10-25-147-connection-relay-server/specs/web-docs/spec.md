## ADDED Requirements

### Requirement: Connection relay self-hosting docs
The daemon page SHALL have a "Self-hosting the connection relay" section, in en-US, pt-BR and es-ES, that says what the relay can and cannot see, how to run its Docker image behind a TLS-terminating proxy (the port, the environment variables for the limits and the client IP header, the health check) and how to point the daemon at it with the `relays` list in the configuration file.

#### Scenario: Run my own relay
- **WHEN** a reader looks for how to self-host the connection relay
- **THEN** the daemon page in their language explains running the image and listing its `wss://` URL in `relays`

## MODIFIED Requirements

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
