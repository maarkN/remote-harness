## MODIFIED Requirements

### Requirement: Data directory
Updates and install links SHALL be stored under the server's data directory: `updates/assets/<hash>` with the asset's content type next to it, `updates/manifests/<channel>/<platform>/<runtime>/<stamp>-<id>.json` for every publish and `updates/latest/<channel>/<platform>/<runtime>.json` written after it, `app/<token>/<file>` for install links, and `reports/<YYYY-MM-DD>/<id>.zip` for problem reports. Every write MUST go to a temporary file in the same directory and be renamed into place, and a store MUST refuse a key that resolves outside its root.

#### Scenario: Interrupted publish
- **WHEN** the server stops while an asset is being written
- **THEN** no partial asset is ever served under its hash

#### Scenario: Path outside the root
- **WHEN** a store is asked for a key with `..` segments
- **THEN** it answers as if the file did not exist and touches nothing

## ADDED Requirements

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
