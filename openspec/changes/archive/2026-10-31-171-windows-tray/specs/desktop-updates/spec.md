## ADDED Requirements

### Requirement: Windows tray
When the service daemon runs in WSL with Windows interop and Windows PowerShell available, it SHALL start a tray helper on the Windows host that shows an icon in the notification area for as long as the daemon runs, and the icon SHALL disappear when the daemon stops. The helper MUST be compiled from the source shipped with the daemon when it starts, and MUST NOT require installing anything on the Windows side: it starts at Windows logon through the existing "Remote Harness" logon task (which boots the distribution and with it the daemon) and is removed together with the daemon. It SHALL speak the same menu protocol as the other helpers and show the menu of a helper without window support (the Linux one: status, Waiting for you with the answers, sessions capped at 8, phones, actions, updates and Quit) on both right and left click, with every label translated by the daemon. The icon SHALL be the product mark drawn for the taskbar's light or dark theme, with the ring filled while a session works and the amber dot while a permission waits; its tooltip SHALL be the daemon's tooltip. `tray: false` SHALL disable it, and without interop or PowerShell the daemon MUST keep running headless.

While the Windows tray runs, the daemon's desktop actions in WSL SHALL reach Windows: notifications (an update available, an update starting) SHALL show as Windows notifications from the tray icon; opening a folder or the docs SHALL open it in Windows; actions that run a command in a terminal (New session, Pair a phone in the terminal, Run doctor) SHALL open Windows Terminal in the daemon's distribution.

#### Scenario: Icon at logon
- **WHEN** a Windows user with the "Remote Harness" logon task logs in
- **THEN** the distribution boots, the daemon starts and the Remote Harness icon appears in the notification area

#### Scenario: Waiting permission from Windows
- **WHEN** a `Bash` permission waits in a session of the WSL daemon
- **THEN** the Windows icon shows the amber dot, and Allow under "Waiting for you" answers the request as if the app had

#### Scenario: Daemon stops
- **WHEN** the WSL daemon stops (service stopped, distribution shut down)
- **THEN** the helper's input closes and the icon disappears

#### Scenario: No interop
- **WHEN** WSL interop is disabled or `powershell.exe` cannot start
- **THEN** no tray is shown and the daemon works headless as before

#### Scenario: Update notification
- **WHEN** an update becomes available on the daemon's channel while the Windows tray runs
- **THEN** a Windows notification from the Remote Harness icon says so
