## MODIFIED Requirements

### Requirement: Demo banner and exit
While the demo runs, the session list, the conversation and the terminal SHALL show a banner saying it is a demo, with an action to leave it, and Settings SHALL show a Demo card with the same action in place of the Computers card, without the Machine card's Forget and rename actions. Leaving SHALL close the demo connection and return to the pairing screen, and MUST clear every piece of demo state the app holds: its sessions, transcripts, pending requests, drafts, pinned and hidden sessions. Leaving MUST NOT remove or change any paired computer. Pairing a real computer while in the demo SHALL end the demo the same way. The demo SHALL not survive an app restart: the app starts on the pairing screen again. In a screenshot build (`REMOTE_HARNESS_SCREENSHOTS=1` at build time, see store-distribution) the banner and the Demo card SHALL NOT be rendered and the pairing screen SHALL open the demo by itself; everything else about the demo is unchanged.

#### Scenario: Leave the demo
- **WHEN** the user taps **Leave demo** on the banner
- **THEN** the pairing screen appears, and opening the demo again shows its initial state without the drafts typed before

#### Scenario: Restart during the demo
- **WHEN** the app is killed while in the demo and opened again
- **THEN** the pairing screen appears

#### Scenario: Screenshot build
- **WHEN** a screenshot build starts with no paired computer
- **THEN** the demo's session list appears by itself and no banner or Demo card is shown
