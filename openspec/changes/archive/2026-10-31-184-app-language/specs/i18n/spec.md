## MODIFIED Requirements

### Requirement: App language
The app SHALL show its texts in the language of a preference kept on the device: **Same as the phone** (the default) or one of `pt-BR`, `en-US`, `es-ES`. With "Same as the phone" the app SHALL follow the device language: `pt-*` → `pt-BR`, `es-*` → `es-ES`, otherwise `en-US`, picking up a device language changed while the app was in the background. An explicit language SHALL be used whatever the device language is. Changing the preference SHALL apply at once to every open screen, header title, sheet and menu, without restarting the app, and the choice SHALL be restored on the next launch before the first screen is drawn. Texts that come from the computer (push notifications, CLI hints, the setup) SHALL keep the daemon's language, and the voice transcription language SHALL keep its own setting, whose "Same as the app" option follows the app's language.

On the very first launch, while no computer is paired and no language was ever saved, the app SHALL show a language step before the pairing screen: the three languages by their native names and "Same as the phone" (preselected, naming the language it resolves to). Tapping an option SHALL preview it on the step itself, and **Continue** SHALL save the choice and open the pairing screen. The step MUST NOT be shown again once a language was saved, nor to a user who already has a paired computer.

Settings SHALL offer the same options in a **Language** card, applied at once and persisted.

#### Scenario: iPhone in Spanish
- **WHEN** the iPhone language is `es-MX` and the preference is "Same as the phone"
- **THEN** the app is shown in `es-ES`

#### Scenario: Explicit language over the device one
- **WHEN** the iPhone language is `es-MX` and the user picks `English (US)` in Settings → Language
- **THEN** every open screen switches to English at once and the app opens in English after a relaunch

#### Scenario: Back to the phone's language
- **WHEN** the preference is `English (US)` on a phone in Portuguese and the user picks "Same as the phone"
- **THEN** the app switches to `pt-BR`

#### Scenario: First launch
- **WHEN** the app is opened for the first time with no computer paired
- **THEN** the language step is shown with "Same as the phone" selected, and Continue opens the pairing screen

#### Scenario: Preview on the step
- **WHEN** the user taps `Español` on the language step of a phone in English
- **THEN** the step's own texts are shown in Spanish before Continue is tapped

#### Scenario: Existing user
- **WHEN** the app is updated on a phone that already has a paired computer
- **THEN** the session list opens as before, without the language step

#### Scenario: Unknown device language
- **WHEN** the device language is `fr-FR` and the preference is "Same as the phone"
- **THEN** texts are shown in `en-US`
