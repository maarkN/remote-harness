## ADDED Requirements

### Requirement: Voice settings applied from launch
The transcription language, Polish dictation and push-to-talk choices SHALL be restored from the device's persisted storage at app startup, before any recording can start, so the first recording after launching the app already uses the saved choices, whether or not Settings has ever been opened.

#### Scenario: First recording after a cold start
- **WHEN** the user relaunches the app after choosing pt-BR as the transcription language and turning Polish dictation on, and records a message without opening Settings
- **THEN** the recording is transcribed in pt-BR and the transcript goes through Polish dictation

## MODIFIED Requirements

### Requirement: Polish dictation rewrite
Settings SHALL offer a "Polish dictation" toggle (off by default, noted as Claude Code sessions only). When on and the session's profile is a Claude Code profile without a model provider, finishing a recording SHALL send only the finalized transcript (never audio) to the daemon, which runs that profile's `claude` CLI once, non-interactively, with tool use disabled, outside any project directory, to rewrite the text: remove filler words, hesitations and repetitions, fix punctuation and grammar, and keep technical terms, file names and code exactly as said. When the rewrite differs from the original, the app SHALL show both for the user to choose from (Use original / Use polished) before anything is inserted into the prompt field. When the setting is off, the profile does not support it, the rewrite fails or times out, or the rewrite is identical to the original, the original transcript SHALL be inserted directly, with no extra step and no error shown to the user. When the daemon does not recognize the `voice.polish` request at all (an older daemon that predates it), the app SHALL tell the user Polish dictation needs a newer daemon before inserting the original transcript, instead of failing silently like the other cases.

#### Scenario: Rewrite accepted
- **WHEN** "Polish dictation" is on, the session uses a Claude Code profile, and the rewrite differs from "so, um, let's, let's continue the tests okay"
- **THEN** the user sees both versions and picking "Use polished" inserts the rewritten text into the prompt field

#### Scenario: Unsupported profile falls back silently
- **WHEN** "Polish dictation" is on but the session's profile uses Codex or routes through a model provider
- **THEN** the original transcript is inserted directly, with no review step and no error

#### Scenario: Rewrite call fails or times out
- **WHEN** the daemon's `claude` call errors or does not return within its timeout
- **THEN** the original transcript is inserted directly, with no error shown to the user

#### Scenario: No audio or recording ever leaves the phone
- **WHEN** "Polish dictation" is on
- **THEN** only the finalized transcript text is sent to the daemon, never the recorded audio

#### Scenario: Daemon too old for Polish dictation
- **WHEN** "Polish dictation" is on and the daemon rejects `voice.polish` as an unknown message type
- **THEN** the app tells the user Polish dictation needs a newer daemon and then inserts the original transcript
