## 1. Question card

- [x] 1.1 `stepAt()` in `permissions/interaction.ts` (question at a clamped step, answered, last, complete) with tests
- [x] 1.2 `QuestionCard` shows one question per step: progress line, Back, Next (needs an answer), Send on the last (needs every answer), Decline on every step; answers kept across steps
- [x] 1.3 i18n `permissions.question.progress` / `back` / `next` in pt-BR, en-US and es-ES

## 2. Daemon

- [x] 2.1 Broker regression test: two questions in a row in one session, each answered on its own

## 3. Verification

- [x] 3.1 Typecheck, tests and Biome; the two scenarios of #473 still to try on a device against a real session
