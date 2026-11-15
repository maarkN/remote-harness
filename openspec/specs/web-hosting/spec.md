# web-hosting Specification

## Purpose
Runs `remoteharness.app` as one Node server built from `apps/web`, in Docker behind the server's Traefik, keeping the published updates and install links in a data directory that survives redeploys.

## Requirements

### Requirement: Site server
`remoteharness.app` SHALL be served by a Node server built from `apps/web` (`dist/server.js`, bundled by Vite with no runtime dependencies) that answers every route the `web-landing`, `web-docs`, `updates-server` and `project-domain` capabilities describe. It SHALL read its port, data directory, publish tokens and app install link (`APP_INSTALL_URL`) from the environment, build the request origin from the `X-Forwarded-Proto` and `Host` headers, and stop accepting connections and exit on SIGTERM once the open requests finish.

#### Scenario: Same answers as before
- **WHEN** a client requests the landing, a docs page, `/install`, `/api/updates/manifest` or an install-link page
- **THEN** the server answers with the same status, headers and body the Worker answered

#### Scenario: Graceful stop
- **WHEN** the container is stopped during a request
- **THEN** that request completes and the process exits

### Requirement: Data directory
Updates and install links SHALL be stored under the server's data directory: `updates/assets/<hash>` with the asset's content type next to it, `updates/manifests/<channel>/<platform>/<runtime>/<stamp>-<id>.json` for every publish and `updates/latest/<channel>/<platform>/<runtime>.json` written after it, `app/<token>/<file>` for install links, and `reports/<YYYY-MM-DD>/<id>.zip` for problem reports. Every write MUST go to a temporary file in the same directory and be renamed into place, and a store MUST refuse a key that resolves outside its root.

#### Scenario: Interrupted publish
- **WHEN** the server stops while an asset is being written
- **THEN** no partial asset is ever served under its hash

#### Scenario: Path outside the root
- **WHEN** a store is asked for a key with `..` segments
- **THEN** it answers as if the file did not exist and touches nothing

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

### Requirement: Problem report uploads
`POST /api/reports` SHALL take one problem report as an `application/zip` body of at most 25 MB (answering 413 above it, 415 for another type or a body that is not a zip), store it as `reports/<YYYY-MM-DD>/<id>.zip` with a random id, and answer 201 `{ "id": "<id>" }`. It SHALL accept at most 5 uploads per client address per hour (429 after that, the address from `X-Forwarded-For` set by Traefik) and refuse uploads with 507 while the reports folder holds 2 GB or more. Reports older than 30 days SHALL be deleted when the server starts and every 6 hours. No route SHALL read or list reports; any other method on the path answers 405.

#### Scenario: Upload
- **WHEN** the app posts a 3 MB zip
- **THEN** the server answers 201 with an id and the zip is in `reports/<today>/<id>.zip`

#### Scenario: Not a zip
- **WHEN** a client posts a text body as `application/zip`
- **THEN** the server answers 415 and stores nothing

#### Scenario: Too many
- **WHEN** one address posts its sixth report within an hour
- **THEN** the server answers 429

#### Scenario: Retention
- **WHEN** the sweep runs and `reports/` has a folder dated 31 days ago
- **THEN** that folder is deleted and today's stays

#### Scenario: No reading
- **WHEN** a client sends `GET /api/reports`
- **THEN** the server answers 405
