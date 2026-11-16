## 1. Body height

- [x] 1.1 Test first in `features/permissions/interaction.test.ts`: `questionBodyHeight` keeps 360 pt with the keyboard down and fits the space above it (a share of window − keyboard, never under 88 pt) with the keyboard up, on a 667 pt and an 874 pt window; verify it fails, then implement it in `interaction.ts` and verify it passes

## 2. Card

- [x] 2.1 `QuestionCard`: single-line fields `returnKeyType="done"` and blur on submit; a Done button beside the field while it is focused (hides the keyboard); the body's maximum height from `questionBodyHeight` and `useKeyboardHeight`, scrolled to the field when the keyboard opens; "Done" in pt-BR, en-US and es-ES; verify typecheck, Biome and the i18n parity test

## 3. Verification

- [x] 3.1 `turbo run typecheck test` (all packages but the Go relay), Biome and `expo export --platform ios` green
- [x] 3.2 On the iOS simulator (development build, pt-BR, the demo with a temporary four-question request, not committed): before the fix the Return key was a plain ⏎ with no way out and Recusar / Próxima sat under the keyboard even on the iPhone 17 Pro; after it, on the iPhone 17 Pro and an iPhone SE (3rd generation, 667 pt), the field, OK, Recusar / Voltar / Próxima or Enviar and the composer stay above the keyboard; the ✓ Return key closes choice and multiselect "Outra…"; OK closes every kind (the number pad also gets iOS's own Done bar); a text answer keeps "hi\nOk" after OK. The SE check moved the body's share of the room above the keyboard from 30 % to 25 %, so the composer is not cut either
- [ ] 3.3 Pending: the same on an Android phone (Return key and Done button) and on iPad with the on-screen keyboard
