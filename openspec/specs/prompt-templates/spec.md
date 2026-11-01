# prompt-templates Specification

## Purpose
Reusable prompts saved on the phone, with placeholders filled in when they are used, picked from the message composer and from the New session screen.

## Requirements

### Requirement: Template storage
A template SHALL have a title (one line, whitespace collapsed, at most 60 characters) and a text (at most 8 000 characters), both required. Templates SHALL be kept on the device only, in secure storage that is never restored on another device, one item per template plus an index, and MUST NOT be sent to the daemon except as the text of a prompt the user sends; they SHALL NOT appear in push payloads or logs. They SHALL survive forgetting a computer. The app SHALL list them sorted by title, and Settings → Prompt templates SHALL let the user create, edit and delete them, deletion being confirmed. Edits SHALL be saved as soon as they are made and restored when the app starts. All texts MUST be translated.

#### Scenario: Create and relaunch
- **WHEN** the user saves a template titled "Review PR" with the text "Review the open PR on {branch} and list the risks." and relaunches the app
- **THEN** the template is listed in Settings → Prompt templates and in the picker

#### Scenario: Forget the computer
- **WHEN** the user forgets the paired computer
- **THEN** the templates stay on the device

#### Scenario: Limits
- **WHEN** the user types a 70-character title and a 9 000-character text
- **THEN** the title is cut at 60 characters and Save stays disabled, with the text's limit shown, until the text is shortened

### Requirement: Placeholders
A placeholder is `{name}`, `name` being a letter followed by letters, digits, `_` or `-`. When a template is used, the app SHALL fill `{branch}` with the branch of the session (or of the directory on the New session screen), `{folder}` with the directory's last path segment, `{cwd}` with the directory and `{date}` with today's date (`YYYY-MM-DD`). When every placeholder of the template has a value, the text SHALL be inserted at once; otherwise a form SHALL ask for the template's placeholders, one field each, the known values pre-filled and editable, before inserting. A placeholder left blank SHALL stay in the text as typed (`{name}`), so it is noticed before sending.

#### Scenario: Known placeholders
- **WHEN** the user picks "Review the open PR on {branch}" in a session on branch `fix/login`
- **THEN** "Review the open PR on fix/login" is inserted without a form

#### Scenario: Asked placeholders
- **WHEN** the template reads "Release notes for {version} since {since}"
- **THEN** a form asks for `version` and `since`, and Insert puts the filled text in the prompt

#### Scenario: Blank value
- **WHEN** the user leaves `version` blank and taps Insert
- **THEN** the text keeps `{version}` where it was

### Requirement: Templates in the composer
The session options menu SHALL offer "Prompt templates…", disabled in a read-only session, and the keyboard toolbar SHALL show a `{}` button next to `@` and `/`; both open the templates picker. Picking a template SHALL append its filled text to the prompt draft, after a blank line when the draft already has text, and leave the prompt to be sent by the user. The picker SHALL offer "Save the prompt as a template" when the composer has text, opening the editor with that text, and "Manage templates", opening Settings → Prompt templates; with no templates it SHALL say so and offer to create one. All texts MUST be translated.

#### Scenario: Insert into an empty composer
- **WHEN** the composer is empty and the user picks "Run the tests and fix what fails"
- **THEN** the composer reads that text and nothing is sent

#### Scenario: Append to a draft
- **WHEN** the composer reads "Context: the login flow" and the user picks a template
- **THEN** the template's text follows the draft after a blank line

#### Scenario: Save the current prompt
- **WHEN** the composer reads "Summarize yesterday's commits" and the user picks "Save the prompt as a template", gives it a title and saves
- **THEN** the template is listed with that text and the composer still reads the prompt

#### Scenario: Read-only session
- **WHEN** the session has no tmux pane
- **THEN** "Prompt templates…" is disabled in the menu

### Requirement: Template as the first prompt
Under the First prompt field of the New session screen, a "Use a template…" button SHALL open the templates picker with the directory's branch and path as the placeholder context; picking one SHALL fill the First prompt field, appending to what is typed after a blank line. The button SHALL be shown only when the First prompt field is.

#### Scenario: Template with the branch
- **WHEN** the directory is on branch `fix/login` and the user picks "Review the open PR on {branch}"
- **THEN** First prompt reads "Review the open PR on fix/login"

#### Scenario: Kimi CLI profile
- **WHEN** the selected profile runs Kimi CLI
- **THEN** neither the First prompt field nor "Use a template…" is shown
