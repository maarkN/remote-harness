## MODIFIED Requirements

### Requirement: Content-free payload
The payload MUST contain only a generic title, the profile name, `sessionId`, the event type and `requestId` when present; never prompts, commands or paths. Schedule pushes (`scheduleRan`, `scheduleFailed`, `scheduleMissed`) carry the schedule's title (a label the user wrote, at most 60 characters) as the body instead of the profile name, and never the schedule's prompt.

#### Scenario: Permission request
- **WHEN** a `Bash` call asks for permission
- **THEN** the push says "Permission pending" and the profile, without the command

#### Scenario: Schedule missed
- **WHEN** the schedule "Daily summary" is missed
- **THEN** the push says "Scheduled prompt missed" and "Daily summary", without the prompt
