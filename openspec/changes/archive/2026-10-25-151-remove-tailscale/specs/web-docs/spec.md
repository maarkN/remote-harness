## MODIFIED Requirements

### Requirement: Documentation search
Each docs page SHALL offer a search field that filters an embedded index of the current language's sections (page title, heading, text) as the visitor types, listing matching headings as links to their anchors, without calling any service.

#### Scenario: Search a term
- **WHEN** the visitor types "relay" on any docs page
- **THEN** the sections whose heading or text mention it are listed, each linking to its page and anchor
