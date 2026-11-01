# i18n Specification

## Purpose
Shows the CLI, the setup, push notifications and the app in pt-BR, en-US or es-ES, with the language chosen in the setup (computer side) and the device language (app).

## Requirements

### Requirement: Supported languages
The daemon, the CLI, `install.sh` and the app SHALL show every user-facing text in `pt-BR`, `en-US` or `es-ES`, from catalogs that MUST have the same keys. `en-US` SHALL be the fallback.

#### Scenario: Catalog parity
- **WHEN** a key exists in one catalog
- **THEN** it exists in the other two (typecheck and tests fail otherwise)

#### Scenario: Unknown system language
- **WHEN** the system or device language is `fr-FR`
- **THEN** texts are shown in `en-US`

### Requirement: Language choice in the setup
`remote-harness setup` SHALL ask the language as its first question, defaulting to the saved language or the system one, and MUST save the choice as `language` in `config.json`, keeping the other keys.

#### Scenario: Choosing Spanish
- **WHEN** the user picks `Español` in the first question
- **THEN** the rest of the setup is in Spanish and `config.json` has `"language": "es-ES"`

#### Scenario: Non-interactive
- **WHEN** the setup runs with `--yes`
- **THEN** it uses `--lang`, else the saved language, else the system one, without asking

### Requirement: Daemon language
CLI commands and push notifications SHALL use the `language` from `config.json`, or the system language when it is absent. Push texts MUST NOT include session content in any language.

#### Scenario: Push in English
- **WHEN** `language` is `en-US` and a session needs permission
- **THEN** the notification text is in English and contains only the profile and the event

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
