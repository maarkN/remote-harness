---
title: Cloud server
description: Run the daemon on a cloud VM (AWS, DigitalOcean, GCP, Oracle): ports and firewalls, the service without a login session, the terminal over SSH, unstable connections.
applies: 0.21+
---

The daemon runs the same on a cloud VM as on a computer at home: install it with the one-line installer over SSH, run `remote-harness setup`, and pair the phone by scanning the QR code the setup prints in the terminal. This page covers what is different on a server: no one is logged in, you reach it over SSH, and the network sits behind a provider's firewall.

## Ports and network

**No inbound port is needed.** The daemon opens an outbound connection to its [connection relay](/en/docs/daemon/#self-hosting-the-connection-relay) and the app meets it there, end-to-end encrypted. The VM only needs outbound HTTPS (TCP 443) to:

- `us.relay.remoteharness.app` and `br.relay.remoteharness.app`, the connection relays (or your own);
- `push.remoteharness.app`, for notifications, unless you use your own Firebase service account;
- `github.com`, for `remote-harness update`.

Most providers allow all outbound traffic by default. On a network that filters egress, allow those hosts; `remote-harness doctor` says whether the relays answer.

The **direct path** (the WebSocket on port `7337`, `wsPort` in the config) is optional on a server. The daemon advertises the addresses of its own network interfaces, and on AWS, GCP and Oracle Cloud the public IP is not one of them (the provider translates it), so a phone only reaches those addresses over a VPN such as Tailscale or WireGuard, whose interface address the daemon also advertises. Container and VM bridges (`docker0`, `br-…`, `virbr0`…) are left out. On DigitalOcean the public IP is on `eth0`, so opening `7337` makes the direct path work from anywhere; the channel is still Noise-encrypted and only paired phones get in, but prefer the VPN or limit the rule to addresses you trust. Never open the hooks port (`7338`): it only listens on `127.0.0.1`.

### Firewall rules by provider

Only for the direct path; skip this section when the relay is enough.

| Provider | Where | Rule |
| --- | --- | --- |
| AWS EC2 / Lightsail | The instance's security group (Lightsail: Networking → IPv4 firewall) | Inbound TCP `7337` from your source range |
| DigitalOcean | Networking → Firewalls (Cloud Firewall attached to the droplet) | Inbound TCP `7337` from your source range |
| Google Cloud | VPC network → Firewall | `gcloud compute firewall-rules create remote-harness --allow tcp:7337 --source-ranges <range> --target-tags remote-harness`, and the tag on the VM |
| Oracle Cloud | The subnet's security list or the VNIC's network security group, **and** the VM's own `iptables` | Ingress TCP `7337`, then `sudo iptables -I INPUT -p tcp --dport 7337 -j ACCEPT` and `sudo netfilter-persistent save` (Oracle's Ubuntu images reject everything but SSH in `iptables`) |

With `ufw` on the VM, also run `sudo ufw allow 7337/tcp`. To turn the direct path off entirely, set `"direct": "off"` in the [configuration file](/en/docs/daemon/#configuration-file).

## Keep the daemon running without a login

- **Service**: `remote-harness service install` (the setup does it) creates a systemd user unit. A user unit stops when your last SSH session ends unless lingering is on; the setup offers `loginctl enable-linger`, or run `sudo loginctl enable-linger "$USER"` yourself. `loginctl show-user "$USER" -p Linger` should say `Linger=yes`, and `remote-harness service status` that the unit is active.
- **Keys**: the daemon keeps its keys in the Secret Service when `secret-tool` is installed and a keyring answers. A server without a desktop session usually has no keyring, so the daemon falls back to a `0600` file in `~/.remote-harness/secrets/` and remembers that choice. `remote-harness doctor` names the store in use; `REMOTE_HARNESS_TOKEN_STORE=file` forces the file. Moving from one store to another loses the keys: pair the phone again afterwards.
- **Without systemd** (some container images): run `remote-harness start` in a tmux window and reattach after a reboot.
- **Sleep**: a cloud VM does not idle-sleep, so the keep-awake setting changes nothing there. Stopping the instance (or a spot instance being reclaimed) stops the daemon and the sessions with it; the service starts again with the VM, the tmux sessions do not.

## The terminal over SSH

- **`TERM`**: SSHing in from Ghostty or kitty sends a terminal type the server may not know (`xterm-ghostty`, `xterm-kitty`). The launchers fall back to `xterm-256color`; to keep your terminal's features copy its description: `infocmp -x "$TERM" | ssh <host> -- tic -x -`. See [the alias says "missing or unsuitable terminal"](/en/docs/troubleshooting/#the-alias-says-missing-or-unsuitable-terminal).
- **Locale**: minimal images often have no UTF-8 locale, and tmux then draws boxes and accents wrong. Install one and set it in your shell profile: `sudo locale-gen en_US.UTF-8` (Debian/Ubuntu), then `export LANG=en_US.UTF-8` in `~/.profile`. The daemon itself already runs tmux in UTF-8 mode.
- **Attaching**: your alias opens the session in the `claude-remote` tmux session and attaches to it; detach with `Ctrl-b d` before closing SSH. The session keeps running and stays controllable from the phone.

## Unstable connections

The keepalives are shorter than any common idle timeout: the relay pings the daemon and the phone every 25 s, the daemon drops a relay connection that is silent for 90 s and reconnects, and the app pings a quiet connection every 30 s and replaces one that does not answer within 10 s. NAT gateways (AWS 350 s, Google Cloud NAT 20 minutes) and load balancers (often 60 to 350 s) therefore should not cut a connection that is in use.

If the app still keeps reconnecting:

- Update both sides: `remote-harness update` on the server and the app from Settings → App. Earlier versions let the relay close a quiet connection after 10 minutes, and the app tried every advertised address before the relay on each reconnect.
- Look for `relay connection closed` and `relay connection failed` in `~/.remote-harness/logs/daemon.log`: many of them point at the server's network (an egress proxy, a firewall that cuts long connections). `remote-harness doctor` checks that the relays answer.
- Do not put the daemon's port behind a load balancer: the relay path needs nothing inbound. If you do expose `7337` through one, enable WebSocket support and set its idle timeout to at least 60 s.
- A firewall that silently drops (instead of refusing) port `7337` is fine: the app gives up on a direct address after 3 s and, once connected through the relay, reconnects there first.

The investigation behind these settings is in [issue #442](https://github.com/maarkN/remote-harness/issues/442). Still stuck? Open an issue with the output of `remote-harness doctor` and the daemon log lines around the drops, as described in [getting help](/en/docs/troubleshooting/#getting-help).
