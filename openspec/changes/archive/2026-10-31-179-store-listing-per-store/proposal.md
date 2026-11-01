## Why

The store listing catalog (`apps/mobile/store/metadata.ts`) has one full description and one release notes text per language, used for both stores, and the description names both platforms in the live status bullet. App Store Review guideline 2.3.10 forbids naming other mobile platforms in App Store metadata, so the first submission would be rejected on that text (issue #480). Google Play has no such rule, but the Play text should not describe iPhone, iPad, iOS, Siri or the App Store either.

## What Changes

- `description` and `releaseNotes` become `{ ios, android }` in the three languages, built by one helper from shared parts: an intro per store, the same feature bullets (a bullet may have per-store wording where the feature differs, such as the live status on the lock screen or in a notification), the same how-it-works and privacy paragraphs. The other fields stay shared.
- The fastlane script writes the App Store variants under `store/fastlane/metadata/ios/<locale>/` and the Google Play variants under `store/fastlane/metadata/android/<locale>/`.
- Tests: limits per variant (description 4000, release notes 500 on both stores), same shape in the three languages, keywords trimmed and within 100 characters, and a guard that no App Store text matches Android or Google and no Google Play text matches iPhone, iPad, iOS, App Store, Siri or Dynamic Island.
- Copy refreshed for the first store release in pt-BR, en-US and es-ES (release notes "First release on the App Store" / "on Google Play", keywords, promotional text).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `store-distribution`: the listing texts have an App Store variant and a Google Play variant, and the test suite enforces the platform rule.

## Impact

`apps/mobile/store/metadata.ts`, `apps/mobile/scripts/store-metadata.mts`, `apps/mobile/scripts/store-metadata.test.ts`. Generated trees under `store/fastlane/` are ignored by git. No app code, protocol or daemon change.
