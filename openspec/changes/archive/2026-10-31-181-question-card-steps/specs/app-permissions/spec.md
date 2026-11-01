## MODIFIED Requirements

### Requirement: Question card
For a pending request with a question `interaction`, the app SHALL show a card in the session with the title and the questions one at a time, as the agent's own prompt does: the current question with its header, its options as single or multiple choice, a free-text "Other" for choice questions, a text field for `text` and `number` questions and, when the call carries more than one question, a "Question N of M" line with Back and Next to move between them. Next MUST be enabled only once the current question has an answer, and answers MUST be kept when moving between questions. Send SHALL be shown on the last question, MUST be enabled only when every question has an answer, and sends `permission.answer` with all the answers; Decline SHALL be available on every question and sends `permission.respond` `deny`. All labels MUST be translated.

#### Scenario: Single choice
- **WHEN** the user taps the option "Postgres" and Send
- **THEN** the app sends `permission.answer` with that label for the question

#### Scenario: Multiple choice with Other
- **WHEN** the user picks "Unit" and "E2E" and types "smoke" in Other
- **THEN** the answer is "Unit, E2E, smoke"

#### Scenario: Several questions in one call
- **WHEN** `AskUserQuestion` arrives with three questions and the user answers the first and taps Next
- **THEN** the card shows the second question with "Question 2 of 3", Back returns to the first with its pick kept, and Send appears on the third and sends the three answers together

#### Scenario: Answered on the computer
- **WHEN** `permission.resolved` arrives for the question
- **THEN** the card disappears
