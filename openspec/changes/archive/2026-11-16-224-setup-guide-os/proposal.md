## Why

The first-run setup guide always shows the `curl … | bash` command and mentions the PowerShell one only inside the text (#564, iPhone screenshot). `buildSetupGuide` takes an OS but ignores it, and the screen passes the phone's OS, not the computer's. The intro says "macOS, Linux or Windows with WSL", while the body offers native PowerShell, which in fact sets up WSL2 itself (the site's install page says so). Someone on Windows sees a command that does not run there, and nothing to copy.

## What Changes

- Step 1 starts with the computer's system: **macOS**, **Linux** or **Windows**. Only after the choice the guide shows that system's command in the code block (`curl -fsSL https://remoteharness.app/install | bash` for macOS and Linux, `irm https://remoteharness.app/install | iex` for Windows), with **Copy the command** and **Send the command to the computer** (share sheet).
- The intro lists macOS, Linux and Windows, and the Windows text says what the PowerShell installer does: it sets up WSL2 with Ubuntu when missing and runs the Linux installer inside it, as the site's install page already says.
- `buildSetupGuide(t, system)` takes the chosen system (or `null` before the choice), with Vitest tests per system.
- Texts in pt-BR, en-US and es-ES.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-pairing`: a new "First-time setup guide" requirement (the system choice, the command per system, copy and share, the WSL2 wording).

## Impact

- App: `features/pairing/setup-guide.ts` (+ test), `features/pairing/SetupGuideScreen.tsx`, the three catalogs.
- No daemon, site or protocol change: the site already serves the right script per client.
