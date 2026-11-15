# guided-installer Specification

## Purpose
Installs and configures Remote Harness on the Mac with a single command and a guided wizard.

## Requirements

### Requirement: One-line installation
`install.sh` SHALL install or update the code in `~/.remote-harness/src`, build the daemon and open the wizard, failing with a clear message on unsupported systems or without git. Missing `tmux` and `ripgrep` MUST be installed via Homebrew when available. When Node 24+ is missing, it SHALL download the latest Node 24 from nodejs.org into `~/.remote-harness/node`, verify its SHA-256 against the official `SHASUMS256.txt`, and use it only for Remote Harness, without changing the user's shell or system Node.

#### Scenario: First installation
- **WHEN** the user runs `curl -fsSL https://remoteharness.app/install.sh | bash`
- **THEN** the code is downloaded and built, and the wizard starts

#### Scenario: Update
- **WHEN** the script runs with the code already installed and no local changes
- **THEN** the code moves to the requested ref and is rebuilt

#### Scenario: No terminal
- **WHEN** there is no `/dev/tty`
- **THEN** the setup runs without questions, using the detected profiles

#### Scenario: Fresh system without Node
- **WHEN** the installer runs on a fresh Ubuntu (for example inside WSL) without Node
- **THEN** Node 24 is downloaded into `~/.remote-harness/node` after its checksum is verified, and the daemon, the `claude-remote` shortcut and the service use it

### Requirement: Profile wizard
`remote-harness setup` SHALL show the logo, detect the Claude Code configuration directories, let the user choose the profiles and set the alias and name of each, and only write after confirmation. The alias MUST be valid, unique and different from `claude` and `claude-remote`.

#### Scenario: Two accounts
- **WHEN** `~/.claude` and `~/.claude-work` exist and the user chooses the aliases `personal` and `work`
- **THEN** `config.json` now has both profiles and the `personal` and `work` commands open each account's Claude Code in tmux

#### Scenario: New account
- **WHEN** the user chooses "Create a new account" and enters the folder (suggested `~/.claude-trabalho`)
- **THEN** the wizard creates the folder, opens Claude Code with `CLAUDE_CONFIG_DIR` pointing to it for login, checks the login when the user returns (`oauthAccount` or `primaryApiKey` in `.claude.json`) and adds the account to the list; without a login, it offers to open it again, add it anyway or discard it

#### Scenario: No accounts found
- **WHEN** no configuration directory exists and the wizard is interactive
- **THEN** it offers to create a new account instead of exiting

#### Scenario: Another tool's directory
- **WHEN** `~/.claude-mem` (claude-mem plugin) exists, or a `~/.claude-*` without `settings.json`, `.claude.json`, `.credentials.json` or `projects/`
- **THEN** it is not offered as an account

#### Scenario: Invalid alias
- **WHEN** the user types `claude` as the alias
- **THEN** the wizard rejects it and asks for another

#### Scenario: Profile removed
- **WHEN** a configured profile is unselected
- **THEN** its launcher and hooks are removed

### Requirement: Installer redirect
`https://remoteharness.app/install` SHALL deliver `install.sh` to curl and wget (macOS, Linux, WSL), and `install.sh` started from Git Bash, MSYS or Cygwin on Windows MUST stop with a message that shows `irm https://remoteharness.app/install | iex`.

#### Scenario: curl
- **WHEN** `curl -fsSL https://remoteharness.app/install` is run
- **THEN** the script content is downloaded

#### Scenario: Git Bash on Windows
- **WHEN** the user runs `curl -fsSL https://remoteharness.app/install | bash` in Git Bash
- **THEN** the installer stops and prints the PowerShell command

### Requirement: Tutorial in the app
The pairing screen SHALL offer a step-by-step guide for those who installed the app before setting up the computer: install Remote Harness on the computer with the one-line command `curl -fsSL https://remoteharness.app/install | bash` (the Windows command `irm https://remoteharness.app/install | iex` is named in the step), with a share action that sends `https://remoteharness.app/install` (which shows the right command for the computer that opens it), and pair via the QR code.

#### Scenario: App installed first
- **WHEN** the user opens the app without pairing and taps "First time? Set up your computer"
- **THEN** they see the steps in order, with the install command and the install link ready to share and a shortcut back to the QR scanner

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

### Requirement: OpenRouter profiles in the wizard
The accounts step of `remote-harness setup` SHALL offer "Add an OpenRouter profile", which asks the name (default `OpenRouter`), the alias (same validation and PATH clash check as accounts), the config folder (default the first free of `~/.claude-openrouter`, `~/.claude-openrouter-2`…, created when missing, no login asked) and an optional default model, then the key in a hidden prompt. The key SHALL be checked against the gateway (see model-providers "Provider key check") and stored with the provider key store only after the summary is confirmed and the config written; an empty key MUST skip storing it and print the `remote-harness provider key <alias>` command. When the setup runs again, every configured provider profile SHALL be listed with whether its key is stored, offering keep, replace the key or remove the profile; its folder MUST NOT be offered in the Claude Code accounts checkbox. Removing a provider profile SHALL remove its launcher, its hooks and its stored key. All texts MUST be translated.

#### Scenario: Add an OpenRouter profile
- **WHEN** the user chooses "Add an OpenRouter profile", keeps the defaults, types a key the gateway accepts and confirms the summary
- **THEN** `config.json` has a profile `openrouter` with `provider: { kind: "openrouter" }` and folder `~/.claude-openrouter`, its launcher is installed, and the key is stored under `provider-openrouter` without being printed

#### Scenario: Rejected key
- **WHEN** the gateway answers 401 to the key
- **THEN** the wizard says the key was rejected and offers to type it again, keep it anyway or skip it

#### Scenario: Setup again
- **WHEN** the setup runs with a configured provider profile and the user chooses "Remove the profile"
- **THEN** the profile leaves `config.json`, its launcher and hooks are removed and its key is deleted from the secret store

#### Scenario: Replace the key
- **WHEN** the user chooses "Replace the key" for a provider profile and types a new key
- **THEN** the new key replaces the stored one and the profile is otherwise unchanged

### Requirement: Main profile configuration for a new profile
When `remote-harness setup` creates a Claude Code profile (a new account, or an OpenRouter profile) in a folder other than `~/.claude`, and `~/.claude` exists, it SHALL offer, before the login, a checklist of what to bring from `~/.claude`, every item checked: settings (`settings.json`), memory (`CLAUDE.md`), skills, commands, agents (the `skills/`, `commands/` and `agents/` folders), plugins (`plugins/installed_plugins.json` and `plugins/known_marketplaces.json`; `enabledPlugins` comes with the settings) and MCP servers (the `mcpServers` of `~/.claude.json`, merged into the new folder's `.claude.json`). One more item, unchecked by default, SHALL link skills, commands and agents to `~/.claude` instead of copying them: a folder the new profile does not have yet becomes a symlink to the main one (so later additions show in both), and in a folder it already has, each missing entry is linked. Unchecking every item MUST leave the folder as setup made it. The copy is one-time and MUST NOT bring `.credentials.json`, `oauthAccount` or any other key of `.claude.json` but `mcpServers`, `history.jsonl`, `projects/` or any other file not listed here. Writing SHALL be read → merge → backup → atomic write and idempotent, and MUST NOT overwrite what the new profile already has: an existing settings key or MCP server keeps its value, an existing file, folder or folder entry stays. The daemon's hooks and status line wrapper MUST be removed from the copied settings; setup installs them for the new profile like for every profile. Setup SHALL print what it copied, linked or left as it was. All texts MUST be translated (pt-BR, en-US, es-ES).

#### Scenario: Copy into a new account
- **WHEN** the user creates the account `~/.claude-work`, keeps every item checked and logs in
- **THEN** `~/.claude-work` has the settings of `~/.claude` (with the profile's own hooks), its `CLAUDE.md`, skills, commands, agents and plugin lists, its `.claude.json` has the MCP servers of `~/.claude.json`, and it has no `.credentials.json`, history or `projects/` from `~/.claude`

#### Scenario: Link instead of copy
- **WHEN** the user also checks the link item
- **THEN** `~/.claude-work/skills`, `commands` and `agents` are symlinks to the folders of `~/.claude`, and a skill added to `~/.claude/skills` later shows in sessions of the new profile

#### Scenario: Decline
- **WHEN** the user unchecks every item
- **THEN** nothing is copied and the folder stays empty until the login

#### Scenario: Existing content wins
- **WHEN** the new folder already has a `settings.json` with `"model": "opus"` and an MCP server `github`, and `~/.claude` has `"model": "sonnet"`, `"theme": "dark"` and a different `github` server
- **THEN** the new `settings.json` keeps `"model": "opus"` and gains `"theme": "dark"`, the new `github` server is unchanged, and the previous `settings.json` is kept as a backup

#### Scenario: Twice
- **WHEN** the copy runs again on the same folder
- **THEN** nothing changes and no file is written

#### Scenario: Skills in the app
- **WHEN** a session of the new profile is started from the app after the copy
- **THEN** its `/` list shows the copied skills under Profile
