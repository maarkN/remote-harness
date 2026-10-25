## MODIFIED Requirements

### Requirement: Tutorial in the app
The pairing screen SHALL offer a step-by-step guide for those who installed the app before setting up the computer: install Remote Harness on the computer with the one-line command `curl -fsSL https://remoteharness.app/install | bash` (the Windows command `irm https://remoteharness.app/install | iex` is named in the step), with a share action that sends `https://remoteharness.app/install` (which shows the right command for the computer that opens it), and pair via the QR code.

#### Scenario: App installed first
- **WHEN** the user opens the app without pairing and taps "First time? Set up your computer"
- **THEN** they see the steps in order, with the install command and the install link ready to share and a shortcut back to the QR scanner
