## ADDED Requirements

### Requirement: Connection paths config
The config SHALL accept `relays` (a non-empty list of `wss://` or `ws://` URLs, default `wss://us.relay.remoteharness.app` and `wss://br.relay.remoteharness.app`), `relay` (`on` or `off`, default `on`) and `direct` (`on` or `off`, default `on`); a config with both `relay` and `direct` `off` MUST be refused with an error naming them.

#### Scenario: Self-hosted relay
- **WHEN** `relays` is `["wss://relay.example.com"]`
- **THEN** the daemon uses only that relay as its home relay

#### Scenario: Both paths off
- **WHEN** the config has `"relay": "off"` and `"direct": "off"`
- **THEN** the daemon refuses to start and says that at least one path must stay on
