## 1. Store

- [x] 1.1 Tests first in `features/conversation/store.test.ts`: `loaded` is false before the reply and true after an empty `transcript.page`, entries stay empty until a `transcript.entries` adds one, and a failed subscription sets the error with `loaded` still false; verify they fail
- [x] 1.2 `StreamState.loaded`, set by the subscription's reply (every branch) and by hydrating from the history cache; verify the tests of 1.1 and the other store tests pass

## 2. Screen

- [x] 2.1 Pure `emptyConversation({ loaded, error }, canPrompt)` → `error` | `loading` | `firstPrompt` | `noMessages` with a Vitest test; verify it passes
- [x] 2.2 `ConversationScreen`'s empty list uses it (`canPrompt` = a composer is shown), keys `conversation.emptyFirstPrompt` and `conversation.emptyNoMessages` in pt-BR, en-US and es-ES; verify typecheck and the i18n parity tests

## 3. Verification

- [x] 3.1 `turbo run typecheck test` (all packages but the Go relay) and Biome green
- [x] 3.2 On the iOS simulator (demo or a daemon), a conversation with no entries after the first page shows the empty state (Release build, iPhone SE, pt-BR, demo session with its entries emptied: "Digite seu primeiro prompt para começar…")
- [ ] 3.3 Pending, with a real computer: started from the app with and without a first prompt, with Claude Code and one other agent (Codex)
