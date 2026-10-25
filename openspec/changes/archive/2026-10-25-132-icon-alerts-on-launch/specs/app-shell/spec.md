## MODIFIED Requirements

### Requirement: App icon follows the theme
The app SHALL offer one alternate app icon per theme (Dark, Light, Dracula, Catppuccin Mocha, Catppuccin Latte — the same flat, glow-free artwork as "App icon"), selectable independently of the in-app theme through a device-only preference: **Match theme** (default; the home-screen icon follows the resolved theme and switches when it changes), **Original** (the default icon, whatever the theme), or one specific theme's icon (**Custom**). Settings → App icon SHALL show an App icon row naming the current choice, opening a modal with a scrollable list of every choice (Match theme first, then Original and one per theme), each row showing a preview of the icon it applies and a check mark on the selected one; "Match theme"'s row previews the icon the resolved theme currently gives it. On iOS the icon SHALL change as soon as the preference or the resolved theme changes (the OS shows its own confirmation alert on every change, so the app MUST NOT change it on a timer or any other repeated trigger). The app MUST NOT change the icon before both the saved theme and the saved app icon preference have been read at launch, and MUST NOT ask again for the icon it already asked for in the same launch; opening the app with an unchanged preference and theme MUST NOT change the icon. On Android the change SHALL be deferred until the app goes to the background, since switching the active launcher activity can take a moment and may close the app on some launchers. Devices that do not support alternate icons SHALL keep the default icon regardless of the preference.

#### Scenario: Default behavior
- **WHEN** the app is installed and the user has not changed Settings → App icon
- **THEN** the preference is "Match theme" and the home-screen icon matches the resolved theme

#### Scenario: Switching theme with Match theme
- **WHEN** the preference is "Match theme" and the user switches the app's theme to Catppuccin Mocha
- **THEN** the home-screen icon becomes the Catppuccin Mocha icon (on iOS right away with the system confirmation; on Android once the app is backgrounded)

#### Scenario: Original regardless of theme
- **WHEN** the preference is "Original" and the user switches themes
- **THEN** the home-screen icon stays the default Tether mark on the dark gradient

#### Scenario: Picking a specific icon
- **WHEN** the user opens the App icon row and taps the Dracula row in the list
- **THEN** the home-screen icon becomes the Dracula icon and stays that way even if the app's theme later changes

#### Scenario: Unsupported device
- **WHEN** the device does not support alternate app icons
- **THEN** Settings → App icon has no effect and the default icon keeps showing

#### Scenario: Opening the app with a custom icon
- **WHEN** the preference is "Dracula", the home-screen icon is already the Dracula icon and the user opens the app
- **THEN** the icon is not changed and iOS shows no icon alert, even while the saved preferences are still being read
