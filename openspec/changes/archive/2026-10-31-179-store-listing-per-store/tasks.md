## 1. Catalog

- [x] 1.1 `PlatformText` (`{ ios, android }`) for `description` and `releaseNotes`; `buildDescription()` joins the per-store intro, the shared bullets (per-store wording allowed) and the shared paragraphs
- [x] 1.2 Copy for the first store release in pt-BR, en-US and es-ES, within the limits

## 2. Script and tests

- [x] 2.1 `store-metadata.mts` writes each store's variants into its own fastlane tree
- [x] 2.2 Tests: limits per variant, same shape, keywords, and the guideline 2.3.10 guard (no Android/Google in App Store texts, no iPhone/iPad/iOS/App Store/Siri/Dynamic Island in Google Play texts)

## 3. Verification

- [x] 3.1 Typecheck, tests and Biome; `store:metadata` run and the trees checked
