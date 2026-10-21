## MODIFIED Requirements

### Requirement: Prompt sending
The prompt field SHALL send `session.input` with `mode: auto` and clear the field after the `ack`, whether the prompt was sent or queued; on error, it MUST keep the text and show the message. In a read-only session the field MUST be disabled and its placeholder say so (`Read-only session`). Otherwise the placeholder SHALL name the agent when it is known (`Message Claude Code…`) and say `Message the agent…` when it is not. The placeholder MUST stay on one line whatever the language and width, ending in an ellipsis when it does not fit, so the empty field never grows. While the message would be queued (the session is `running` or `waiting`, a permission is pending or prompts are already queued), the composer SHALL show the hint `Hold: send now · ⌘⏎` and label the send button as queueing; a long press on Send, and ⌘⏎ on a hardware keyboard, SHALL send with `mode: now`. The session's queued prompts SHALL be shown in a dashed `QUEUED · N` card above the composer, numbered in order, each with its text, a photo count when it has attachments, the delivery error when one failed, and Edit, Remove and Send now actions; the card SHALL offer `Send all now`. Remove MUST NOT be adjacent to Send now: a full row SHALL separate them, with Remove at the row's top-right corner and Edit and Send now at the row's bottom-right (Send now last, styled as the primary action), so a mis-tap cannot turn a tap on Send now into Remove. Each action MUST keep a hit area of at least 44×44pt. The card mirrors `session.queue` and disappears when the queue is empty.

#### Scenario: Successful send
- **WHEN** the user sends "continue" to an idle session
- **THEN** the field is cleared and the prompt appears in the conversation once written to the transcript

#### Scenario: Queued while busy
- **WHEN** the user taps Send while the session is running
- **THEN** the field is cleared, the card shows `QUEUED · 1` with the message, and nothing is pasted until the turn ends

#### Scenario: Send now
- **WHEN** the user long-presses Send (or presses ⌘⏎) while the session is running
- **THEN** the prompt is pasted immediately, mid-turn

#### Scenario: Placeholder
- **WHEN** a Claude Code session is open and the field is empty
- **THEN** it reads "Message Claude Code…" on one line

#### Scenario: Placeholder on a narrow phone
- **WHEN** the composer is shown in pt-BR on a 320 pt wide screen
- **THEN** the placeholder stays on one line, cut with an ellipsis if needed, and the empty field keeps its one-line height

#### Scenario: Failed delivery shown
- **WHEN** the daemon could not deliver the first queued prompt
- **THEN** its row shows the error and Send now retries it

#### Scenario: Remove kept away from Send now
- **WHEN** a queued row is shown, with or without a two-line message or a delivery error
- **THEN** Remove sits alone in the row's top-right corner and Send now sits in the row's bottom-right, so the two buttons share no edge
