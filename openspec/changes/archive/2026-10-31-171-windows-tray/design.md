## Context

Tray helpers are thin renderers started by the service daemon (`infra/tray-helper.ts` → `TrayHost`): the daemon writes the translated menu as JSON lines on the helper's stdin and reads clicks from its stdout; when stdin closes the helper exits. On macOS the helper is Swift compiled by `swiftc` on first use; on Linux it is a Python script. In WSL `trayCommand` returns `unavailable`. The daemon already runs Windows programs through interop at runtime: the keep-awake helper is `powershell.exe -Command …` kept alive by its stdin (`infra/power.ts`), and "Open in terminal" uses `wt.exe`.

## Goals / Non-Goals

**Goals:** a Windows icon with the same menu as Linux, no Windows-side install, the same lifecycle as the other helpers, Windows notifications for the daemon's desktop notifications.

**Non-Goals:** a Windows popover or Preferences window (the helper reports no `windows`/`popover` support); starting the icon while the distribution is not running; a signed binary.

## Decisions

- **C# compiled by `Add-Type`, not a shipped binary.** Windows PowerShell 5.1 is on every Windows 10/11 machine and compiles C# against .NET Framework (WinForms, GDI+, `JavaScriptSerializer`) at start. The source ships in the daemon's checkout like `Tray.swift`, so updates come with `remote-harness update` and nothing needs building in CI, signing or a download. Alternatives: .NET/WinUI or Rust/Go binaries (need a build pipeline, code signing against SmartScreen, and a Windows-side install/uninstall in `install.ps1`); a pure PowerShell script (background reads need runspaces and the UI code is clumsy). The C# stays within C# 5 (the language level of Windows PowerShell's compiler).
- **Started by the daemon over interop, not by a Windows logon task.** Spawning `powershell.exe` from the daemon reuses `TrayHost` unchanged (early exit = headless, restarts, Quit), gives the icon exactly the daemon's lifetime (stdin closing ends it) and needs no socket between Windows and WSL. The logon task that boots the distribution at logon already makes it start at logon. Alternative: a Windows logon task starting the helper, which runs `wsl.exe … tray attach` to reach the daemon through a socket — a new transport, a reconnect loop and a Windows-side install, for the only benefit of an icon while the distribution is down.
- **Source path through `wslpath -w`.** `Add-Type -Path` reads `\\wsl.localhost\<distro>\…\Tray.cs` directly; no copy to the Windows file system. The bootstrap is passed with `-Command` (as the keep-awake helper does, which leaves stdin to the script), with `-ExecutionPolicy Bypass` and `-WindowStyle Hidden`.
- **UTF-8 on raw streams.** The helper reads stdin and writes stdout through UTF-8 `StreamReader`/`StreamWriter` on the raw standard streams, since the console code page would mangle translated labels.
- **Notifications through the helper.** `{ type: 'notify', title, body }` on the same channel; the helper shows a balloon tip, which Windows 10/11 renders as a notification of the icon. On WSL, `createDesktop` takes a `notify` sink; the updates feature points it at `TrayHost.notify` (a no-op while no helper runs).
- **WSL desktop actions.** `open(path)`: `explorer.exe` with the path converted by `wslpath -w` (URLs as is). `runInTerminal(command)`: `wt.exe wsl.exe -d $WSL_DISTRO_NAME sh -c '<command>; exec "$SHELL"'`, like "Open in terminal".
- **Taskbar theme.** The mark is drawn white on a dark taskbar and black on a light one (`SystemUsesLightTheme` under `HKCU\…\Themes\Personalize`, re-read on `UserPreferenceChanged`); the amber dot is the only color.

## Risks / Trade-offs

- [Untested on real Windows in CI] → the C# is compile-checked with `mcs -langversion:5` against the WinForms/GDI+/System.Web.Extensions assemblies in a Mono container, the daemon side is covered by Vitest, and the PR lists the manual checks on a Windows machine.
- [Group Policy forcing `AllSigned` overrides `-ExecutionPolicy Bypass`] → the helper exits at once and the daemon stays headless, as on a Linux server without a display.
- [`Add-Type` compiles on every start (about a second)] → acceptable for a process that starts once per daemon start.
- [Interop unavailable inside a systemd user service on some WSL builds] → same dependency as the existing keep-awake helper; the daemon stays headless.

## Migration Plan

None: daemons that update get the helper on their next start; `tray: false` keeps it off.
