## MODIFIED Requirements

### Requirement: Status bar
The session screen SHALL show a second context line under the first with, when known: the model as an outlined chip (with the effort level after a dot, `sonnet-5.5 · high`), the provider as a dashed chip (`via OpenRouter`, from the session's profile), the git branch (`⎇`), and then the context window usage and the profile's 5-hour and weekly usage limits. Items without data MUST be hidden (never shown as `0%`), a limit whose reset time has passed MUST be hidden, and the whole line MUST be hidden when nothing is known. Percentages SHALL use secondary text below 70%, Claude orange from 70% and red from 90%. Tapping the line SHALL open a sheet with the details (tokens used and window size, reset times in the device's locale). The sheet SHALL end with a **Session details** row, on phones and tablets alike, that closes it and opens the "Session details" sheet of the same session in one tap. All texts MUST be translated.

#### Scenario: Full data
- **WHEN** the session reports Opus 5.5, effort high, context 62%, the folder is on branch `feat/rate-limit` and the profile reports 41% (5 h) and 73% (week)
- **THEN** the line shows the chip `Opus 5.5 · high`, `⎇ feat/rate-limit`, the context percentage and both limits

#### Scenario: OpenRouter session
- **WHEN** the session belongs to a profile whose provider is OpenRouter
- **THEN** the line shows the dashed chip `via OpenRouter` after the model chip

#### Scenario: No data
- **WHEN** the session has no status and its folder is not in git
- **THEN** no second context line is shown

#### Scenario: Near the limit
- **WHEN** the weekly limit reaches 92%
- **THEN** its percentage is shown in red

#### Scenario: Details
- **WHEN** the user taps the line
- **THEN** a sheet shows `124k / 200k` tokens and when each limit resets

#### Scenario: From status to details
- **WHEN** the status sheet is open and the user taps **Session details**
- **THEN** the status sheet closes and the Session details sheet opens with the folder, branch, profile, mode and session ID of the same session
