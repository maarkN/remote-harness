## MODIFIED Requirements

### Requirement: Update command
`remote-harness update [--ref <ref>] [--force]` SHALL update an installation made by the installer: fetch the ref (default `main`) into `~/.remote-harness/src`, run the new `install.sh --update` (checks, dependencies and build without the wizard), refresh launchers, shortcut, PATH and hooks idempotently, restart the background service only when it is installed, and print the old and new version. It MUST NOT ask setup questions or show the pairing code, MUST refuse a checkout other than the installer's or one with local changes, and SHALL say when the installation is already up to date. The update MUST behave the same whatever directory it is run from, and it MUST NOT wait on input the user cannot see: every tool the installer probes or runs with its output hidden SHALL run from the source checkout with its input closed, so a package-manager shim resolves the version pinned by the checkout and never asks a download question.

#### Scenario: New version available
- **WHEN** the user runs `remote-harness update` and `main` has new commits
- **THEN** the code is rebuilt, the service is restarted and the CLI prints `0.3.0 → 0.3.1`

#### Scenario: Already up to date
- **WHEN** the fetched commit is the installed one
- **THEN** nothing is rebuilt and the CLI says it is up to date (unless `--force`)

#### Scenario: Development checkout
- **WHEN** the CLI runs from a clone outside `~/.remote-harness/src`
- **THEN** it refuses and suggests `git pull` and a build

#### Scenario: Installer only
- **WHEN** the user runs `curl -fsSL https://remoteharness.app/install.sh | bash -s -- --update`
- **THEN** the update runs the same way, without the wizard

#### Scenario: Run from another directory
- **WHEN** the user runs `remote-harness update` from `/` on a computer whose `pnpm` is the Corepack shim and the latest pnpm is not in Corepack's cache
- **THEN** the build starts right away with the pnpm pinned by the source checkout, and nothing waits for an answer the user cannot see
