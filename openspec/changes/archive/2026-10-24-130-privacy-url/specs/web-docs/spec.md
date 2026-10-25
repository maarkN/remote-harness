## ADDED Requirements

### Requirement: Privacy policy address
The privacy policy SHALL also be served at `/privacy` (with or without the trailing slash) in the language negotiated from `Accept-Language`, with the same content as `/docs/privacy/` and `https://remoteharness.app/privacy` as its canonical URL, so the stores can link one stable address. The policy SHALL name its publisher (Alvyn Tech) and a privacy contact (`privacy@remoteharness.app`), and SHALL say how to ask for the deletion of the error reports and performance data already sent.

#### Scenario: Store link in Portuguese
- **WHEN** a browser that prefers Portuguese opens `/privacy`
- **THEN** the privacy policy renders in Portuguese with a `Vary: Accept-Language` header and the canonical URL `https://remoteharness.app/privacy`

#### Scenario: No language preference
- **WHEN** a client without `Accept-Language` opens `/privacy/`
- **THEN** the privacy policy renders in English

#### Scenario: Contact
- **WHEN** a visitor reads the policy in any language
- **THEN** it names Alvyn Tech as the publisher and links `privacy@remoteharness.app`
