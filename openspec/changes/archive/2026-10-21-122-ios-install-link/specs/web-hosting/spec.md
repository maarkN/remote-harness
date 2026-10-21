## MODIFIED Requirements

### Requirement: Site server
`remoteharness.app` SHALL be served by a Node server built from `apps/web` (`dist/server.js`, bundled by Vite with no runtime dependencies) that answers every route the `web-landing`, `web-docs`, `updates-server` and `project-domain` capabilities describe. It SHALL read its port, data directory, publish tokens and app install link (`APP_INSTALL_URL`) from the environment, build the request origin from the `X-Forwarded-Proto` and `Host` headers, and stop accepting connections and exit on SIGTERM once the open requests finish.

#### Scenario: Same answers as before
- **WHEN** a client requests the landing, a docs page, `/install`, `/api/updates/manifest` or an install-link page
- **THEN** the server answers with the same status, headers and body the Worker answered

#### Scenario: Graceful stop
- **WHEN** the container is stopped during a request
- **THEN** that request completes and the process exits

### Requirement: Docker deploy
`apps/web/deploy/` SHALL hold a Dockerfile (Node 22 Alpine, non-root user, health check) and a compose file that joins the external `web` network and declares a Traefik router for `Host(\`remoteharness.app\`)` on the `websecure` entry point with the `le` certificate resolver, mounts `./data` as the data directory and reads the publish tokens and the app install link from `.env` next to it. `make deploy-web` SHALL build the bundle, copy it with the deploy files to `REMOTE_HARNESS_WEB_SSH:REMOTE_HARNESS_WEB_DIR` without touching `data/`, leave `.env` as it is except for setting `APP_INSTALL_URL` when that variable is given (a path or an https URL; anything else stops the deploy), make the data directory writable by the container user, rebuild and restart the container and fail unless it reports healthy. The repository MUST NOT contain the tokens, the install link or the server's address.

#### Scenario: Deploy
- **WHEN** the owner runs `make deploy-web` with `REMOTE_HARNESS_WEB_SSH` set
- **THEN** the new bundle is live behind Traefik and the previous data is untouched

#### Scenario: Missing host
- **WHEN** `REMOTE_HARNESS_WEB_SSH` is not set
- **THEN** the command stops before building, naming the variable

#### Scenario: Set the install link
- **WHEN** the owner runs `make deploy-web APP_INSTALL_URL=/app/<token>/`
- **THEN** the server's `.env` has that single `APP_INSTALL_URL` line, the other lines unchanged, and the landing's iPhone & iPad card opens it
