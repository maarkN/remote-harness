---
status: accepted
---

# An untrusted, end-to-end encrypted connection relay replaces Tailscale

The app is going to the App Store and Google Play, where users will not have Tailscale. Requiring it also adds an account plus an app on both devices, and on phones it takes the single VPN slot. So the app must reach the daemon from anywhere, on the same network as well, without the user installing anything else. We decided that the daemon and the app connect through a connection relay that the project hosts by default and anyone can self-host (the URL is configurable; the code is MIT). The app and the daemon exchange keys at pairing and encrypt everything end to end, so the relay only forwards ciphertext and never needs to be trusted, keeping the rule that no project infrastructure ever sees session content.

## Considered Options

- **Self-hosted VPN (Headscale / own WireGuard)**: still an external program on the phone and still takes the VPN slot.
- **Relay terminating TLS (sees plaintext)**: simpler, but the project's server would hold every user's sessions.
- **LAN only, no server**: loses the "from anywhere" use that the app exists for.

## Consequences

- Until now the WebSocket ran as plain `ws://` because WireGuard encrypted the link. Without Tailscale every path, the direct one included, needs the end-to-end layer.
- Pairing changes: the QR must carry key material, not just `host + port + token`, so existing pairings must be redone.
- For the first time the daemon keeps a long-lived outbound connection to project infrastructure.
