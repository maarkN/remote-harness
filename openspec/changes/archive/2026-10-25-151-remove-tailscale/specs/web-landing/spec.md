## MODIFIED Requirements

### Requirement: Install section
The install section SHALL show the install command per operating system in tabs (macOS · Linux with `curl -fsSL https://remoteharness.app/install | bash`, Windows with `irm https://remoteharness.app/install | iex`), each with a copy button, the Windows tab preselected on Windows browsers, the requirements as chips (Node 24+ bundled when missing, tmux, git, ripgrep, `claude` or `codex` on PATH), and the app cards (iPhone & iPad, Android) with the current way to get each build. The Android card SHALL open Google Play's testing page for the app (`https://play.google.com/apps/test/com.alvyntech.remoteharness`) and say it installs from Google Play (testing). When the server has an app install link configured (`APP_INSTALL_URL`), the iPhone & iPad card SHALL open it, say the build installs over the air on registered devices, and be followed by a note linking the docs section that explains how to get a device registered or build from source; without it the card SHALL open the getting started docs and say the app is built from source. The install link MUST come from the server's environment, never from the repository. Both commands MUST be present in the markup so the section works without JavaScript.

#### Scenario: Copy the command
- **WHEN** the visitor taps Copy next to the macOS · Linux command
- **THEN** the command is on the clipboard and the button briefly reads the translated "Copied"

#### Scenario: Windows visitor
- **WHEN** the page is opened from a Windows browser
- **THEN** the Windows tab is selected first

#### Scenario: iPhone install link configured
- **WHEN** the server runs with `APP_INSTALL_URL=/app/<token>/` and a visitor taps the iPhone & iPad card
- **THEN** the install link page opens, and the note under the cards links to the docs on registering a device

#### Scenario: No install link
- **WHEN** the server runs without `APP_INSTALL_URL` (or with a value that is neither a path on the site nor an https URL)
- **THEN** the iPhone & iPad card opens the getting started docs and reads "Build from source"

#### Scenario: Android from Google Play
- **WHEN** a visitor taps the Android card
- **THEN** Google Play's testing page for `com.alvyntech.remoteharness` opens, and the card reads "Google Play (testing)" in the page's language
