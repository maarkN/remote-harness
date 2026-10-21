## 1. Logic

- [x] 1.1 `useSessionsStore`: `lastFetchedAt`, set on `applySnapshot`.
- [x] 1.2 `unreachable.ts`: `unreachableView(status, unreachable, hasSessions)` (tests).
- [x] 1.3 `setup-guide.ts`: `TAILSCALE_APP_SCHEME`.

## 2. UI

- [x] 2.1 `UnreachableEmptyState`: title, checklist, Try again / Open Tailscale / troubleshooting link, reconnecting indicator.
- [x] 2.2 `UnreachableNotice`: compact "offline list from {{time}}" + Try again, shown above a stale list.
- [x] 2.3 `SessionsScreen`: wire both into the list's `ListEmptyComponent` and above the `FlashList`.
- [x] 2.4 `app/(main)/index.tsx`: the iPad detail pane shows the same checklist instead of "Select a session".
- [x] 2.5 i18n in pt-BR, en-US and es-ES.

## 3. Docs

- [x] 3.1 `apps/web/content/*/troubleshooting.md`: a section listing the same checks, in all three languages.

## 4. Verify

- [x] 4.1 `pnpm check` and `openspec validate --strict`; `npx expo export --platform ios`.
