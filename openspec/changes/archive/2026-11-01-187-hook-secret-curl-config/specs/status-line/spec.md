## MODIFIED Requirements

### Requirement: Status line wrapper installation
The installer SHALL write a `remote-harness-statusline` script to the launcher folder and set each profile's `statusLine` to a `command` that runs it, keeping the user's previous command (if any) encoded in the command's argument and every other key of the `statusLine` object. The script MUST forward its stdin to the daemon in the background with a short timeout and MUST then run the original command with the same input, so the terminal output is unchanged; when the daemon is not running the status line MUST still work. The script MUST NOT contain the hook secret: its `curl` reads the secret header from the hook secret's curl config file (`-K`), so the secret is in no process's arguments. Running the installer twice MUST produce the same file, and the write MUST follow read → merge → backup → atomic write.

#### Scenario: User status line kept
- **WHEN** the profile already has `statusLine.command` `bash ~/.claude/statusline.sh`
- **THEN** after install the terminal shows the same status line and the daemon receives the status JSON

#### Scenario: No previous status line
- **WHEN** the profile had no `statusLine`
- **THEN** the wrapper prints nothing and the daemon still receives the status JSON

#### Scenario: Script without the secret
- **WHEN** the wrapper script is written
- **THEN** it names the curl config file and does not contain the secret value, and the daemon still authenticates the status JSON it forwards

#### Scenario: Reinstall
- **WHEN** the installer runs a second time
- **THEN** `settings.json` is unchanged

#### Scenario: Uninstall
- **WHEN** the user runs `remote-harness uninstall`
- **THEN** the original `statusLine` is restored, or removed when there was none
