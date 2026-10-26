## ADDED Requirements

### Requirement: Try the demo
While no computer is paired, the pairing screen SHALL offer **Try the demo**, which opens the in-app offline demo (see `demo-mode`) without pairing anything. With at least one paired computer (pairing another one from Settings) the action SHALL NOT be shown.

#### Scenario: First launch
- **WHEN** the app opens for the first time
- **THEN** the pairing screen shows **Try the demo** next to the setup guide

#### Scenario: Adding a second computer
- **WHEN** the user opens the pairing screen from Settings → Computers → Add
- **THEN** **Try the demo** is not shown
