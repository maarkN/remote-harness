## 1. Footer

- [x] 1.1 `siteFooter()`: row → contributors → `small.legal` → "Made by", without the `.fine` wrapper
- [x] 1.2 `styles.ts`: the notice as a full-width block; `.fine` rules removed

## 2. Verify

- [x] 2.1 Test of the footer order on the landing, a docs page and the install page in the three languages; `pnpm check` and `openspec validate --strict`
- [x] 2.2 Looked at the footer in a browser
