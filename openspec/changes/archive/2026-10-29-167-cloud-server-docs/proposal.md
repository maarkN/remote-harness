## Why

Running the daemon on a cloud VM raises questions the docs do not answer in one place: which ports to open, how it keeps running without a login session, how the terminal behaves over SSH, and what to do when the connection is unstable (#441, with the findings of #442).

## What Changes

- New docs page "Cloud server" (`/docs/cloud-server/`) in en-US, pt-BR and es-ES, after "The daemon": ports and network (no inbound port on the relay path; outbound 443 to the relays, push and GitHub; the optional direct path and when a public IP works), firewall rules per provider (AWS, DigitalOcean, Google Cloud, Oracle Cloud, `ufw`), keeping the daemon running without a login (linger, systemd user unit, Secret Service and file fallback, no systemd, sleep), the terminal over SSH (`TERM`, locale, tmux), and unstable connections (keepalives versus NAT and load balancer idle timeouts, logs, load balancers), linking #442.
- Links from the docs index, the daemon page (background service), the troubleshooting page (away from home) and both READMEs.

## Capabilities

### New Capabilities

### Modified Capabilities
- `web-docs`: the cloud server page joins the documentation pages.

## Impact

- `apps/web/content/<locale>/cloud-server.md` (new), `index.md`, `daemon.md`, `troubleshooting.md`; `apps/web/src/docs/content.ts`; `README.md`, `README.pt-BR.md`.
- Deploy with `make deploy-web` after merging.
