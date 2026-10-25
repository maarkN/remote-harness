## Purpose

How a daemon is reachable: through its home connection relay from anywhere, and directly over the addresses it advertises, with the same end-to-end channel on both paths.

## ADDED Requirements

### Requirement: Home relay
Unless `relay` is `off`, the daemon SHALL at start measure the round trip to each URL in `relays` (an HTTPS `GET /healthz`, the fastest of two tries, 3 s timeout), connect to the fastest that answers as its home relay and open its room by answering the relay's challenge with its Ed25519 relay key. It SHALL keep that relay while it works, reconnecting with backoff when the connection drops, and only after three failed reconnects in a row measure again and move to the fastest relay that answers. Every change of home relay SHALL be announced to the connected devices. When no relay answers the daemon SHALL keep retrying in the background without affecting the direct path.

#### Scenario: Fastest relay
- **WHEN** the US relay answers in 180 ms and the Brazil relay in 15 ms
- **THEN** the daemon opens its room on the Brazil relay

#### Scenario: Short drop
- **WHEN** the home relay restarts (close code 1012) and is back within seconds
- **THEN** the daemon reconnects to the same relay

#### Scenario: Relay down
- **WHEN** three reconnects to the home relay fail in a row and the other relay answers
- **THEN** the daemon moves its room to the other relay and announces it

### Requirement: Relay path
Each device channel the home relay opens SHALL run the same Noise connection as the direct path (preface, handshake, `auth` gate, frames). A close the daemon decides SHALL be sent to the relay with the daemon's code plus 100 (so 4001 travels as 4101), and the app SHALL read a close code from 4100 to 4199 as that code minus 100. A device on the relay path MUST get nothing before its handshake completes, as on the direct path.

#### Scenario: Paired device over the relay
- **WHEN** a paired device joins the daemon's room and completes IK
- **THEN** it receives `auth.ok` through the relay

#### Scenario: Unknown key over the relay
- **WHEN** an unpaired key starts IK through the relay
- **THEN** the daemon closes that channel with 4101 and the app reads it as 4001

### Requirement: Direct addresses
Unless `direct` is `off`, the daemon SHALL listen on all interfaces and advertise as direct addresses the `host:port` of its non-loopback, non-link-local interface addresses (IPv4 first, IPv6 in brackets; at most 8), or only the `--host` / `127.0.0.1` address when one is forced. The addresses, the home relay URL and the relay list SHALL be sent in `auth.ok` (`paths`) and in `daemon.paths` whenever they change, and SHALL be what a pairing code carries.

#### Scenario: Home network
- **WHEN** the computer has 192.168.1.20 and a tailnet address 100.101.1.2
- **THEN** `paths.addresses` lists `192.168.1.20:7337` and `100.101.1.2:7337`

#### Scenario: Direct off
- **WHEN** `direct` is `off`
- **THEN** the daemon does not listen for devices, advertises no address and is reached only through the relay
