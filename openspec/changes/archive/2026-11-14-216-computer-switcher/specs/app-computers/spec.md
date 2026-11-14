## MODIFIED Requirements

### Requirement: Computer switcher
The machine line at the top of the session list SHALL open a switcher with the paired computers (name, active one marked) and "Add a computer" (the pairing screen); picking a computer SHALL close the current connection and connect to it, and the session list SHALL show only that computer's sessions. Data fetched from a computer (models, provider info, recent projects, folders, checkout details, commands and file suggestions) SHALL be kept per computer, so none of the previous computer's data shows after a switch.

#### Scenario: Switch
- **WHEN** the user picks the desktop in the switcher
- **THEN** the app disconnects from the laptop, connects to the desktop and lists the desktop's sessions

#### Scenario: No models of the previous computer
- **WHEN** the user opened New session on the laptop, switches to the desktop within ten seconds and opens New session again
- **THEN** the projects and models shown are the desktop's (or loading), never the laptop's
