## 1. Logic and storage

- [x] 1.1 `features/templates/logic.ts`: types, limits, `placeholdersOf`, `builtinValues`, `fillTemplate`, `cleanTitle`, `templatePreview`, `sortTemplates`/`upsertTemplate`, serialize/parse of templates and the index, `newTemplateId`; `logic.test.ts` covers each (`pnpm --filter @remote-harness/mobile exec vitest run src/features/templates`)
- [x] 1.2 `features/templates/store.ts`: Zustand store, `restoreTemplates` (called from the root layout), `saveTemplate`, `deleteTemplate` writing one SecureStore item per template plus the index, this device only

## 2. Screens and sheets

- [x] 2.1 `TemplateEditorForm` (title, text, placeholder hint, Save disabled over the limits, Delete with confirmation) and `TemplateEditorSheet` wrapping it; `TemplatesScreen` at `/templates` (list sorted by title with previews and edit time, New template, empty state) registered in the main layout; `TemplatesCard` in Settings after New session
- [x] 2.2 `TemplatesSheet`: list → direct insert or placeholder form → `onPick(text)`; "Save the prompt as a template" (inline editor) and "Manage templates"; empty state with "New template"

## 3. Entry points

- [x] 3.1 Session menu: `templates` action ("Prompt templates…", disabled when read-only) before "Conversation history"; `session-menu.test.ts` updated; the session route opens the sheet with the session's branch, folder and the draft, appending the pick to the draft
- [x] 3.2 Keyboard toolbar `{}` trigger (`onTemplates` through `PromptComposer` and `SmartComposer`), wired by the session route
- [x] 3.3 New session screen: "Use a template…" under First prompt (only when the field is shown), context from the inspected branch and the directory, appending to the field

## 4. Texts and verification

- [x] 4.1 i18n keys (`templates.*`, `sessionMenu.templates`, `conversation.insertTrigger.template`, `settings.templates`/`templatesHint`, `newSession.useTemplate`) in pt-BR, en-US, es-ES; parity test passes
- [x] 4.2 `pnpm turbo run typecheck test`, Biome (worktree ignore tweak), `npx expo export --platform ios`, `openspec validate 190-prompt-templates --strict`
