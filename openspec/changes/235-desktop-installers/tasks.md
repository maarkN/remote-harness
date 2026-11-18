## 0. Design (this change)

- [x] 0.1 Proposal, design and the `desktop-installers` spec. Decided with the user: first run opens a terminal with `remote-harness setup` (no native first-run window); design only in this batch. Verify `openspec validate 235-desktop-installers --strict` passes.
- [x] 0.2 Follow-up issues, as sub-issues of #620: the release pipeline and packaged updates (#621), macOS (#622), Linux (#623) and Windows (#624). Verify they are on the board in Backlog.

The tasks below are implemented in those issues. This change stays active until they ship, and the spec is then archived from here.

## 1. Release pipeline and packaged updates (#621)

- [ ] 1.1 Runtime bundles per system in a protected release workflow: Node 24 checked against nodejs.org, the `tsup` output with production dependencies, and the prebuilt helpers. The macOS bundle also gets the signed launcher, static `tmux` and universal `ripgrep`. Verify on each system that a bundle unpacked into an empty `HOME` runs `remote-harness --version` and `doctor`.
- [ ] 1.2 The signed manifest per channel on remoteharness.app and the assets on GitHub Releases (releases for `main`, pre-releases for `development`). Verify a tag publishes both.
- [ ] 1.3 `install.json`, the `runtime/<version>` + `current` layout, and the helpers and the launcher taken prebuilt when present. Verify with tests: source installs unchanged, packaged installs never compile.
- [ ] 1.4 The packaged update: verify, unpack, swap, install step, restart, roll back, prune; plus `doctor`. Verify with tests for the tampered bundle, the rollback and the source path untouched, and one real update between two pre-releases.
- [ ] 1.5 Spec updates in `guided-installer` and `daemon-service`.

## 2. macOS (#622)

- [ ] 2.1 The starter app (first open, later opens, migration from a source install) and the notarized `.dmg`. Verify on a clean macOS VM without the Xcode tools or Homebrew: daemon running, tray icon, pairing, no command typed.
- [ ] 2.2 The LaunchAgent on the signed launcher. Verify that the folder-access and notification grants survive an update.

## 3. Linux (#623)

- [ ] 3.1 The `.deb` (dependencies, the embedded bundle, the menu entry, the terminal fallback). Verify on a fresh Ubuntu desktop VM: setup from the menu, daemon and tray running, pairing.

## 4. Windows (#624)

- [ ] 4.1 The signed Inno Setup installer (WSL check and install with resume, Ubuntu, the runtime inside WSL, Windows Terminal). Verify on a Windows 11 VM without WSL.

## 5. Site

- [ ] 5.1 Download buttons per system on the install page, from the `main` manifest, added by each installer's issue. Verify the page on the three systems and that the command stays visible.
