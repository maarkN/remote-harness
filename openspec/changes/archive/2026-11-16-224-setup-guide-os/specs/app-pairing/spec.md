## ADDED Requirements

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
