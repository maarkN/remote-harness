# app-pairing Specification

## Purpose
Links the app to a specific daemon securely, reading the address and token from a QR code or manual entry.

## Requirements

### Requirement: Manual entry
The app SHALL accept a pasted pairing link (the one `remote-harness pair` prints) with the same pairing, for simulators and phones without a camera.

#### Scenario: No camera
- **WHEN** the user denies camera permission
- **THEN** a field to paste the pairing link is offered

### Requirement: Secure storage
Each paired computer's daemon ID, static key, addresses, relays and alias, and this device's key pair for it, MUST be stored only in SecureStore (one item per computer and an index), readable after the first unlock and never leaving this device (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). Later connections SHALL use Noise IK with those keys. The single computer saved by the previous version SHALL move into the list on the first start.

#### Scenario: Reopening the app
- **WHEN** the app is closed and opened
- **THEN** it reconnects to the active computer with IK using the saved keys

#### Scenario: Update from one computer
- **WHEN** the app starts with the single computer item of the previous version
- **THEN** that computer is in the list, active, and the old item is gone

### Requirement: Forget daemon
The Machine card and Settings → Computers SHALL allow forgetting a computer after a confirmation: its keys and alias are erased, its connection closes if it was active, and the app switches to another computer or, when none is left, shows the pairing screen.

#### Scenario: Forget
- **WHEN** the user confirms forgetting the only computer
- **THEN** its keys are erased, the connection closes and the pairing screen appears

### Requirement: Pairing code scan
The app SHALL read the pairing code shown by `remote-harness pair`, the setup, the tray or another device's "Add device" (`remoteharness://pair?v=2&…`, also when opened as a deep link), generate this device's X25519 key pair, announce the code over its direct addresses and, when none answers, over its relay, then show a step asking for the confirmation code the computer now shows ("Enter the code shown on <computer>", a six-digit field, Pair and Cancel) and pair with Noise XXpsk3 and that code over the address or relay that answered the announce, check that the daemon's static key is the one in the code and, on `auth.ok`, add the computer, make it active and ask for this device's name before opening the session list: a screen with the name prefilled (the user-assigned device name when the system gives one other than just "iPhone" or "iPad", else the model, such as "iPhone 15 Pro" or "Pixel 8", else the platform default), **Save**, which sends `devices.rename` once the connection is open, and **Skip**, which keeps the platform default the pairing sent. A failed rename SHALL say so and let the user try again or skip. It SHALL register both the `remoteharness://` and the `claude-remote://` deep-link schemes. It SHALL register both the `remoteharness://` and the `claude-remote://` deep-link schemes. A code the daemon refuses (used, expired, or the device limit reached) MUST save nothing and show why. A wrong confirmation code (4012) SHALL keep the step open with an error to try again; a code burned by wrong attempts (4013) SHALL go back to scanning and say a new pairing code is needed; a computer that does not know the announce (4002) SHALL be told to update Remote Harness on the computer.

#### Scenario: Valid QR
- **WHEN** the user points the camera at a fresh pairing code
- **THEN** the app asks for the confirmation code the computer shows, pairs with it, saves the computer, asks for this device's name and then shows the session list

#### Scenario: QR in another format
- **WHEN** the QR is not a `remoteharness://pair` or `claude-remote://pair` URL with `v=2`
- **THEN** the app shows "Invalid QR" and keeps scanning

#### Scenario: Code already used
- **WHEN** the daemon closes the pairing with 4005
- **THEN** nothing is saved and the app says the code was already used or expired and to show a new one

#### Scenario: Wrong daemon key
- **WHEN** the daemon that answers presents a static key other than the code's
- **THEN** the app drops the connection and saves nothing

#### Scenario: Pairing away from home
- **WHEN** none of the code's direct addresses answers and the code names a relay
- **THEN** the app pairs through that relay

#### Scenario: Name after pairing
- **WHEN** the pairing succeeds on an iPhone 15 Pro whose system name is just "iPhone"
- **THEN** the app shows the name step prefilled with "iPhone 15 Pro", and Save stores that name on the computer before the session list opens

#### Scenario: Skip the name
- **WHEN** the user taps Skip on the name step
- **THEN** the session list opens and the computer keeps the platform default name

#### Scenario: Wrong confirmation code
- **WHEN** the user types digits other than the ones the computer shows
- **THEN** the daemon closes with 4012, nothing is saved, and the step says the code does not match and lets the user type it again

#### Scenario: Older computer
- **WHEN** the computer's daemon does not know the announce and closes it with 4002
- **THEN** nothing is saved and the app says to update Remote Harness on the computer

### Requirement: Pair again after the protocol change
Credentials saved by a version before protocol 2 (a host, port and token) SHALL be discarded at start, and the pairing screen SHALL say that this computer must be paired again with a new code.

#### Scenario: Update from a token pairing
- **WHEN** the app starts with credentials that carry a token
- **THEN** it deletes them and shows the pairing screen with the pair-again notice

### Requirement: Try the demo
While no computer is paired, the pairing screen SHALL offer **Try the demo**, which opens the in-app offline demo (see `demo-mode`) without pairing anything. With at least one paired computer (pairing another one from Settings) the action SHALL NOT be shown.

#### Scenario: First launch
- **WHEN** the app opens for the first time
- **THEN** the pairing screen shows **Try the demo** next to the setup guide

#### Scenario: Adding a second computer
- **WHEN** the user opens the pairing screen from Settings → Computers → Add
- **THEN** **Try the demo** is not shown

### Requirement: First-time setup guide
The pairing screen's setup guide SHALL take people who installed the app before setting up the computer through two steps: install Remote Harness on the computer, then pair. Its intro SHALL name the supported systems as macOS, Linux and Windows. The install step SHALL first ask which system the computer runs, with one choice each for macOS, Linux and Windows, and SHALL show no command until one is chosen. With macOS or Linux chosen it SHALL show `curl -fsSL https://remoteharness.app/install | bash` and say to run it in a terminal on the computer; with Windows it SHALL show `irm https://remoteharness.app/install | iex`, say to run it in PowerShell, and say that it sets up WSL2 with Ubuntu when missing (restart when asked, then run it again) and runs the Linux installer inside it. The chosen command SHALL be shown in a code block with **Copy the command**, which puts exactly that command on the clipboard, and **Send the command to the computer**, which opens the share sheet with it; the choice can be changed at any time. The pair step SHALL keep its Scan the QR code action. All texts MUST be translated.

#### Scenario: Before the choice
- **WHEN** the user opens the setup guide
- **THEN** the install step asks for the computer's system and shows no command

#### Scenario: Windows
- **WHEN** the user picks Windows
- **THEN** the code block shows `irm https://remoteharness.app/install | iex`, the text says to run it in PowerShell and that it sets up WSL2, and Copy the command puts that line on the clipboard

#### Scenario: macOS or Linux
- **WHEN** the user picks Linux after Windows
- **THEN** the code block switches to `curl -fsSL https://remoteharness.app/install | bash` and the text says to run it in a terminal

#### Scenario: Intro agrees with the install step
- **WHEN** the guide is shown in pt-BR, en-US or es-ES
- **THEN** the intro names macOS, Linux and Windows without saying "with WSL", and only the Windows text explains WSL2
