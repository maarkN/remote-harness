## MODIFIED Requirements

### Requirement: Direct addresses
Unless `direct` is `off`, the daemon SHALL listen on all interfaces and advertise as direct addresses the `host:port` of its non-loopback, non-link-local interface addresses, leaving out container and virtual bridge interfaces (names starting with `docker`, `br-`, `veth`, `virbr`, `cni`, `flannel`, `cali`, `vxlan`, `podman`, `lxdbr` or `lxcbr`) (IPv4 first, IPv6 in brackets; at most 8), or only the `--host` / `127.0.0.1` address when one is forced. The addresses, the home relay URL and the relay list SHALL be sent in `auth.ok` (`paths`) and in `daemon.paths` whenever they change, and SHALL be what a pairing code carries.

#### Scenario: Home network
- **WHEN** the computer has 192.168.1.20 and a VPN address 100.101.1.2
- **THEN** `paths.addresses` lists `192.168.1.20:7337` and `100.101.1.2:7337`

#### Scenario: Direct off
- **WHEN** `direct` is `off`
- **THEN** the daemon does not listen for devices, advertises no address and is reached only through the relay

#### Scenario: Cloud server with Docker
- **WHEN** the computer has `ens5` 10.0.1.12 and `docker0` 172.17.0.1
- **THEN** `paths.addresses` lists only `10.0.1.12:7337`
