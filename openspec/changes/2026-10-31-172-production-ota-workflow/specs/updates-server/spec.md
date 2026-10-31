## MODIFIED Requirements

### Requirement: Publisher and CI
`make publish-ota`, `make publish-ota-dry`, the `ota-development.yml` workflow and the `ota-production.yml` workflow SHALL publish to `https://remoteharness.app/api/updates/` with asset URLs under `https://remoteharness.app/api/updates/assets/`, and the repository MUST NOT contain a runtime link to `maarkn.dev`.

#### Scenario: Merge into development
- **WHEN** a commit lands on `development`
- **THEN** CI publishes the development update to the Worker with the development token and phones on that channel receive it

#### Scenario: Merge into main
- **WHEN** a commit lands on `main`
- **THEN** CI publishes the production update to the Worker with the production token and phones on that channel receive it
