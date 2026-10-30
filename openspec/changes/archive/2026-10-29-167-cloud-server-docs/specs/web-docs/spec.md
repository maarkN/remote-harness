## ADDED Requirements

### Requirement: Cloud server docs
The docs SHALL have a "Cloud server" page (`/docs/cloud-server/`), in en-US, pt-BR and es-ES, for running the daemon on a cloud VM. It SHALL say that the relay path needs no inbound port, only outbound HTTPS to the connection relays, the push endpoint and the git remote; that the direct path (`wsPort`, 7337) is optional, works on a provider's public IP only when that IP is on an interface of the VM (otherwise over a VPN), and is opened with rules given per provider (AWS, DigitalOcean, Google Cloud, Oracle Cloud, `ufw`), never opening the hooks port; how the daemon keeps running without a login (`loginctl enable-linger`, the systemd user unit, the Secret Service and its `0600` file fallback, no systemd); how the terminal behaves over SSH (`TERM`, a UTF-8 locale, attaching and detaching tmux); and how to troubleshoot unstable connections (the keepalive intervals against NAT and load balancer idle timeouts, updating both sides, the daemon log lines, load balancers), linking #442. The daemon and troubleshooting pages SHALL link to it.

#### Scenario: Port question
- **WHEN** someone setting up a daemon on an AWS instance opens the cloud server page
- **THEN** it says that no inbound rule is needed for the relay path and which security group rule opens the optional direct path

## MODIFIED Requirements

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
