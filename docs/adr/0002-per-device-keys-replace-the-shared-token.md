---
status: accepted
---

# Per-device keys and one-time pairing codes replace the shared token

Until now every device used the same bearer token from a long-lived pairing link, so a leaked QR worked forever and rotating the token logged every device out at once. With end-to-end encryption (ADR-0001) we decided that the daemon and each device have their own key pair. A pairing code carries the daemon's public key, its ID, the connection relay URL and a single-use secret that expires within minutes, and the daemon keeps the list of paired devices so that one can be revoked without touching the others. The app also keeps a list of paired computers instead of a single credential. Existing pairings are not migrated: the protocol version goes up and devices pair again.
