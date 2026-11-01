## 1. Daemon

- [x] 1.1 `trayCommand` on WSL: `powershell.exe` bootstrap compiling `tray/windows/Tray.cs` (path from `wslpath -w`), unavailable when `wslpath` fails; Vitest
- [x] 1.2 WSL desktop: `explorer.exe` open (paths via `wslpath -w`), `wt.exe` terminal in `$WSL_DISTRO_NAME`, notifications through an injected sink; Vitest
- [x] 1.3 `TrayHost.notify` sends `{type:'notify'}` to a running helper; the updates feature uses it as the WSL notification sink; Vitest

## 2. Windows helper

- [x] 2.1 `tray/windows/Tray.cs`: JSON-lines reader/writer (UTF-8), `NotifyIcon` + `ContextMenuStrip` from the menu items, clicks, left click opens the menu, exit on EOF
- [x] 2.2 Icon: the mark drawn for light/dark taskbars, working ring, amber dot, tooltip; balloon notifications
- [x] 2.3 Compile check: `mcs -langversion:5` with WinForms, GDI+ and System.Web.Extensions in a Mono container

## 3. Docs and wrap-up

- [x] 3.1 ADR-0005 (Windows tray from WSL over interop)
- [x] 3.2 Daemon docs (en-US, pt-BR, es-ES): the Windows tray icon under WSL
- [x] 3.3 `pnpm turbo run typecheck test` and Biome green
