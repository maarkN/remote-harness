## Context

The session screen already has the transcript (`useTranscriptStore`), pending requests (`usePermissionsStore`, with `interaction` for questions and plans), the session state, and the respond / answer / send paths (`useRespond`, `usePrompt`). Speech recognition exists for dictation (`expo-speech-recognition`, transcription language setting); there is no speech output. The design system follows the theme tokens (`makeStyles`), and screen-reader users already get `accessibilityLiveRegion` updates.

## Goals / Non-Goals

**Goals:** a per-session hands-free mode in the foreground: readout of turns, permissions and questions; short voice commands with confirmations; large controls and haptics; three languages.

**Non-Goals:** speech with the screen locked or the app in the background (needs background audio and a headless path; follow-up issue), wake words ("Hey Remote Harness"), reading tool output or diffs, answering plans by voice.

## Decisions

1. **Pure core, thin hook.** `vocabulary.ts` (words per language, typed, parity-tested), `commands.ts` (`parseCommand(text, language)`), `readout.ts` (plain speakable text from markdown, turn / permission / question sentences) and `engine.ts` (a reducer: given the current prompt and an event or a command, returns the next state and effects — speak, listen, respond, answer, send, exit). `use-hands-free.ts` only connects stores, `expo-speech`, recognition, haptics and keep-awake to the engine.
2. **Design of the bar** (no prototype; follows the app's tokens): full-width bar in place of the composer, minimum 64 pt targets. A large primary **Talk** button (mic icon + label, `accent` fill), and two secondary buttons, **Repeat** and **Exit**, below it; above, one line of state text (`textMuted`) and the last spoken sentence in large text, so a glance is enough. Colors and contrast come from the theme (WCAG test covers them), and every control has an accessibility label.
3. **Languages.** Speech output uses the app language (the sentences come from the app catalogs; agent text is read with the same voice). Recognition uses the transcription language setting (`resolveVoiceLanguage`), and commands are parsed with that language's vocabulary.
4. **Safety by command kind.** Allow / deny / options mirror taps (no extra confirmation, confirmed aloud after). Free text always needs a "yes", because recognition errors would otherwise reach the agent as prompts. Unknown or out-of-range commands only produce a hint.
5. **One listener at a time.** The bar replaces the composer, so dictation and hands-free never listen together; speech stops before listening starts (no echo of the readout into the recognizer).
6. **What is new.** On start the engine records the last entry cursor and the pending request ids; only later turns and requests are read. Items queue while something is being spoken or heard.

## Risks / Trade-offs

- Speech recognition without network may be weaker on some devices. → Same setting as dictation (on-device first).
- Long answers read aloud are tedious. → Cut at ~500 characters on a sentence boundary with "the rest is in the app".
- New native dependencies need a new binary. → Menu item hidden when `expo-speech` is missing (OTA on old binaries).
