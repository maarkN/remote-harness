## ADDED Requirements

### Requirement: Install section with the store links
The install section SHALL show the install command per operating system in tabs (macOS · Linux with `curl -fsSL https://remoteharness.app/install | bash`, Windows with `irm https://remoteharness.app/install | iex`), each with a copy button, the Windows tab preselected on Windows browsers, the requirements as chips (Node 24+ bundled when missing, tmux, git, ripgrep, `claude` or `codex` on PATH), and the app cards (iPhone & iPad, Android) with the current way to get each build. The iPhone & iPad card SHALL open the app's TestFlight public link (`https://testflight.apple.com/join/Vkh3K19G`) and say it installs from TestFlight (beta). The Android card SHALL open the app's Google Play testing link (`https://play.google.com/apps/test/com.alvyntech.remoteharness/10`) and say it installs from Google Play (testing). Both links are public and live in the repository; the landing MUST NOT read the app install link (`/app/<token>/`) or any other link from the server's environment. Both commands MUST be present in the markup so the section works without JavaScript.

#### Scenario: Copy the command
- **WHEN** the visitor taps Copy next to the macOS · Linux command
- **THEN** the command is on the clipboard and the button briefly reads the translated "Copied"

#### Scenario: Windows visitor
- **WHEN** the page is opened from a Windows browser
- **THEN** the Windows tab is selected first

#### Scenario: iPhone from TestFlight
- **WHEN** a visitor taps the iPhone & iPad card
- **THEN** the TestFlight public link opens, and the card reads "TestFlight (beta)" in the page's language, with no note about registering a device

#### Scenario: Android from Google Play
- **WHEN** a visitor taps the Android card
- **THEN** Google Play's testing link for `com.alvyntech.remoteharness` opens, and the card reads "Google Play (testing)" in the page's language

## REMOVED Requirements

### Requirement: Install section
**Reason**: The app is on TestFlight and Google Play (testing): the iPhone & iPad card no longer depends on the server's app install link, and both cards open fixed public links.
**Migration**: Replaced by "Install section with the store links". The ad-hoc install link page (`/app/<token>/`) is unchanged and is shared directly with registered devices.
