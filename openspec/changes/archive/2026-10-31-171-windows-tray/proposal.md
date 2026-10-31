## Why

Under WSL the daemon runs headless: `apps/daemon/tray` only has macOS and Linux helpers, and the WSL distribution has no desktop of its own, so a Windows user has no icon showing whether sessions run or a permission waits, and no desktop notification for updates (#435, split from #160).

## What Changes

- **Windows tray helper.** A new helper for the Windows host, `apps/daemon/tray/windows/Tray.cs`: a notification-area icon (WinForms `NotifyIcon`) compiled from source by Windows PowerShell's `Add-Type` on start, with no binary to build, sign or distribute. It speaks the same JSON-lines menu protocol as the other helpers and renders the same menu as the Linux tray (status, Waiting for you with Allow / Always allow / Deny, sessions, phones, actions, updates, Quit), on right and left click. The icon is the Remote Harness mark drawn for the taskbar's light or dark theme, with the ring filled while a session works and the amber dot while a permission waits.
- **Started by the WSL daemon.** The service daemon in WSL starts the helper through WSL interop (`powershell.exe`), exactly like it already starts the keep-awake helper, with stdin/stdout as the channel; the icon therefore appears whenever the daemon runs — at Windows logon through the existing "Remote Harness" logon task — and disappears when the daemon stops. Without interop or PowerShell the daemon stays headless as before. `"tray": false` turns it off.
- **Windows desktop actions from WSL.** On WSL the daemon's desktop actions stop being no-ops: notifications (update available, updating) become Windows toasts shown by the tray helper, "Open the docs"/"Open logs" open in Windows (`explorer.exe`), and actions that run a command in a terminal (New session, Pair a phone, Run doctor) open Windows Terminal in the distribution.
- **ADR-0005** records the helper's technology and launch direction (C# compiled by `Add-Type`, started by the daemon over interop, rather than a compiled binary installed by `install.ps1` and started by a Windows logon task).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `desktop-updates`: new "Windows tray" requirement (the helper, how it starts and stops, the WSL desktop actions).

## Impact

- `apps/daemon/tray/windows/Tray.cs` (new).
- `apps/daemon/src/infra/tray-helper.ts`: `trayCommand` returns the PowerShell command on WSL (the source path converted with `wslpath -w`).
- `apps/daemon/src/infra/desktop.ts`: a WSL desktop (open with `explorer.exe`, terminal with `wt.exe`, notifications through a sink).
- `apps/daemon/src/features/updates/index.ts` and `tray-host.ts`: notifications sent to the helper (`{type:'notify'}`) on WSL.
- `install.ps1`: unchanged (the helper lives in the daemon's checkout inside WSL; nothing is installed on the Windows side).
- `docs/adr/0005-windows-tray-from-wsl-over-interop.md`, daemon docs (three languages).
