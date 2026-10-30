## 1. Pure core

- [x] 1.1 `vocabulary.ts` (allow, deny, yes, no, repeat, stop, option, numbers in pt-BR, en-US, es-ES) with a parity test
- [x] 1.2 `commands.ts`: `parseCommand(text, language)`, with tests (digits and words, several options, accents, punctuation, unknown → message)
- [x] 1.3 `readout.ts`: speakable text from markdown (code, links, lists), sentence cut, turn / permission / question / plan sentences, with tests
- [x] 1.4 `engine.ts`: reducer for prompts, commands, confirmations and effects, with tests (deny sends at once, message needs yes, out-of-range option, stop, repeat, queueing)
- [x] 1.5 i18n keys `handsFree.*` in the three languages

## 2. App

- [x] 2.1 `expo-speech` and `expo-keep-awake` with `npx expo install`
- [x] 2.2 `use-hands-free.ts`: new turns / requests from the stores, speech, one-shot recognition, haptics, keep-awake, respond / answer / send
- [x] 2.3 `HandsFreeBar` and the session menu item; the bar replaces the composer while on

## 3. Verification

- [x] 3.1 `turbo run typecheck test` and Biome green
- [x] 3.2 `expo export --platform ios` bundles; prebuild + `xcodebuild` with the new modules
- [x] 3.3 Docs: hands-free section in the app docs (three languages)
