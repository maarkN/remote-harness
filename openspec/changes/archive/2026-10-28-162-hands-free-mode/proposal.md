## Why

Using the app while the hands and eyes are busy (on a bike, walking, cooking) is hard: dictation only fills the reply field, and permissions, questions and the agent's answers all need looking and tapping (#416). Siri and Google Assistant (#417, #418) cover one-off actions; a session followed for a while needs the app itself to talk and listen.

## What Changes

- A **hands-free mode** per session, turned on from the session menu: the composer becomes a large, high-contrast bar (Talk, Repeat, Exit, the current state) and the screen stays awake.
- The app **reads aloud**, with the system voice in the app language: the end of each turn (the last answer, without code or tool output), each plain permission ("… Say allow or deny.") and each question with its numbered options.
- After each prompt, and when Talk is pressed, the app **listens for a short command** in the transcription language: allow, deny, option numbers, yes / no, repeat, stop, or a message to send. A message is read back and sent only after "yes"; allow / deny and options follow the same rules as taps and are confirmed aloud. Plans and requests handed over to the terminal are announced but answered on the screen.
- Haptics mark when the app starts and stops listening and when something was sent.
- Not in this change: reading aloud with the screen locked or the app in the background (needs a background audio mode; follow-up).

## Capabilities

### New Capabilities
- `hands-free`: the in-app hands-free mode (readout, voice commands, confirmations, large controls).

### Modified Capabilities
<!-- none -->

## Impact

- New `apps/mobile/src/features/hands-free/` (vocabulary, command parser, readout texts, state machine — pure and tested; hook and bar).
- Session screen: menu item and the bar in place of the composer while on.
- New native dependencies `expo-speech` and `expo-keep-awake` (installed with `npx expo install`): new binary needed; older binaries hide the menu item.
- i18n keys `handsFree.*` in pt-BR, en-US and es-ES; docs section.
