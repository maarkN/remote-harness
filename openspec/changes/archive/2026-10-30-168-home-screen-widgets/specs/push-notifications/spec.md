## MODIFIED Requirements

### Requirement: Device registration
The app SHALL request notification permission, obtain the FCM token and send `device.register`; the daemon MUST store only tokens received over authenticated connections, keep at most one registration per paired device (the latest), and drop the registrations of devices that are revoked or no longer paired. A registration MAY say `turnActions: true`: that app build draws turn pushes itself on Android (see Turn notification actions); the daemon stores the flag with the token. A registration MAY say `widgets: true`: that app build has widgets fed by the widget refresh push; the daemon stores the flag with the token.

#### Scenario: Token refreshed
- **WHEN** FCM refreshes the token
- **THEN** the app sends the new token and the daemon replaces that device's old one

#### Scenario: Ten devices
- **WHEN** ten paired devices each register their token
- **THEN** all ten receive pushes

#### Scenario: Revoked device
- **WHEN** a device is revoked
- **THEN** its push registration is removed and it receives no further pushes

#### Scenario: Build with widgets
- **WHEN** an app build with widgets registers with `widgets: true`
- **THEN** the daemon keeps the flag and sends that phone widget refresh pushes

## ADDED Requirements

### Requirement: Widget refresh push
The daemon SHALL send a widget refresh push to the devices registered with `widgets: true` when what widgets show changes: the number of waiting sessions (state `waiting` or with a pending request), the number of running sessions or the set of pending permission requests. The push MUST be data only, holding just `event: "widgets"` and the daemon ID (no title, body, session ID or other content); on iOS a background push (`content-available`, push type `background`, priority 5), on Android a data message collapsed under `widgets`. The daemon SHALL send at most one every 30 s, with a trailing push carrying the latest change, and MUST NOT send it while a connected app is in the foreground or with push off. It SHALL go through the push relay like any other push when the daemon has no Firebase service account.

#### Scenario: Request while the phone is locked
- **WHEN** a permission request arrives and no app is in the foreground
- **THEN** devices with widgets receive a data-only push with `event: "widgets"` and the daemon ID, besides the permission push

#### Scenario: Bursty session
- **WHEN** sessions change state ten times within 30 s
- **THEN** at most two widget refresh pushes are sent, the last one after the latest change

#### Scenario: App in front
- **WHEN** an app is connected and in the foreground
- **THEN** no widget refresh push is sent
