## MODIFIED Requirements

### Requirement: Store listing texts
The repository SHALL keep the store listing texts as a typed catalog in pt-BR, en-US and es-ES (`apps/mobile/store/metadata.ts`): name, subtitle, short description, full description, keywords, promotional text, release notes, support URL, marketing URL and privacy policy URL. The full description and the release notes SHALL have an App Store variant and a Google Play variant built from shared parts: Apple's guideline 2.3.10 forbids naming other mobile platforms in App Store metadata, so no App Store text names Android or Google, and no Google Play text names iPhone, iPad, iOS, Siri or the App Store. The three languages MUST have the same shape; the texts MUST respect the stores' limits (App Store name and subtitle 30 characters, keywords 100, promotional text 170, description 4000, release notes 500; Google Play title 30, short description 80, full description 4000, release notes 500); the URLs MUST be pages the site serves; the copy MUST be agent-neutral and name no private project. A script SHALL write the catalog in fastlane's `metadata/` layout for iOS and Android, each tree with its own store's variants.

#### Scenario: Limits
- **WHEN** a translation makes the subtitle longer than 30 characters
- **THEN** the test suite fails naming the language and the field

#### Scenario: Other platform named
- **WHEN** an App Store text names Android or a Google product, or a Google Play text names an Apple device or service
- **THEN** the test suite fails naming the language and the field

#### Scenario: fastlane tree
- **WHEN** the maintainer runs `pnpm --filter @remote-harness/mobile store:metadata`
- **THEN** `store/fastlane/metadata/ios/<locale>/*.txt` (App Store variants) and `store/fastlane/metadata/android/<locale>/*.txt` (Google Play variants) are written for the three languages
