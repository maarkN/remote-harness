## 1. Logic

- [x] 1.1 Tests first in `features/subagents/sort.test.ts`: `cardSubagents` shows at most three (running first, then the most recent), counts the hidden ones and only the hidden running ones (six with five running → three shown, "+3", 2 running); `subagentStateCounts` counts per state; verify they fail
- [x] 1.2 `sort.ts`: `cardSubagents`, `subagentStateCounts`; verify the tests pass

## 2. Card

- [x] 2.1 `SubagentIcons` (lucide icons in the state colors, "+N" / "+N (M running)", one button with the label per state and a hint) on `SessionRow`'s state line in place of the "+N subagents" pill; `SessionListItem` drops the nested lines; `SubagentList.tsx` removed; verify typecheck and Biome
- [x] 2.2 `SessionsScreen` opens the Subagents sheet for the tapped card (live subagents from the store); verify typecheck
- [x] 2.3 Texts (overflow, the label per state with plurals, the hint) in pt-BR, en-US and es-ES; the unused `subagents.more` and `sessions.subagents` keys removed; verify the i18n tests

## 3. Verification

- [x] 3.1 `turbo run typecheck test` (all packages but the Go relay), Biome and `expo export --platform ios` green
- [x] 3.2 On the iOS simulator (iPhone 17 Pro, pt-BR, demo, development build): no lines between cards; the "Dark mode toggle" card shows an accent progress circle and a green check on its state line, in the compact and the expanded density, light and dark; the row reads "… Work, 2 subagentes: 1 rodando, 1 concluído" to screen readers and offers a "Subagentes" action (the row is one element, so the icons' button is also an action of it); tapping the icons opens the Subagents sheet over the list and a row opens "Check the contrast of the dark tokens". The overflow ("+N (M running)") is covered by the Vitest test: the demo has two subagents
- [ ] 3.3 Pending: VoiceOver / TalkBack labels on a device and the card on Android
