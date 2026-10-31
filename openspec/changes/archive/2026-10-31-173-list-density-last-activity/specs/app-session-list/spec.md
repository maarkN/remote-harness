## ADDED Requirements

### Requirement: List density
The session list SHALL offer two densities, remembered on the device: **Compact** (the default), whose rows follow the row anatomy, and **Expanded**, whose rows add, under the folder line, the session's last activity: an icon telling a prompt, a reply or a tool call apart, its text in up to two lines (ellipsized) and its relative time. A row without a known last activity SHALL look the same in both densities. The density SHALL be switched from a ghost chip after the sort chip (also in the compact bar's filters sheet) and from Settings → Appearance; every label MUST be translated (pt-BR, en-US, es-ES) and the preview line SHALL have an accessibility label naming its kind.

#### Scenario: Expanded row
- **WHEN** the density is Expanded and a session's last activity is the reply "Raised the pool to 20" two minutes ago
- **THEN** its row shows, under the folder line, the reply icon, "Raised the pool to 20" and "2 min"

#### Scenario: Compact by default
- **WHEN** the app starts for the first time
- **THEN** the list is Compact and no row shows a preview line

#### Scenario: Remembered
- **WHEN** the user switches to Expanded and restarts the app
- **THEN** the list is still Expanded

#### Scenario: Older daemon
- **WHEN** the density is Expanded and the computer's daemon does not send `lastActivity`
- **THEN** the rows look like Compact rows
