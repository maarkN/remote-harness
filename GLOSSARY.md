# Remote Harness

A personal phone app that follows and controls Claude Code (and other agent) sessions running in tmux on the user's computer, through a daemon on that computer.

## Language

### Connectivity

**Computer**:
A machine (macOS, Linux or WSL) where agent sessions run and a daemon is installed. The app can be paired with several; each is shown by its machine name (the alias chosen in the app, else the host name).
_Avoid_: machine (except in "machine name"), host, desktop

**Daemon**:
The background process on a computer that watches its agent sessions and is the only thing the app talks to.
_Avoid_: server, agent, backend

**Device**:
A phone or tablet running the app, with its own key pair, paired with one or more daemons and revocable on its own.
_Avoid_: client, phone (when tablets are meant too)

**Pairing**:
Establishing mutual trust between a device and a daemon by scanning a one-time, short-lived pairing code.
_Avoid_: login, registration

**Pairing code**:
The QR (or link) a daemon shows to pair one new device; it is single-use and expires within minutes.
_Avoid_: token, pairing link (as a long-lived credential)

**Direct path**:
A connection from a device to a daemon over an address the daemon advertised, without the connection relay.
_Avoid_: LAN mode, local connection

**Relay path**:
A connection from a device to a daemon through the connection relay; always available when both are online.
_Avoid_: cloud mode, remote mode

**Connection relay**:
A server, hosted by the project by default or self-hosted, that forwards end-to-end encrypted traffic between the app and a daemon when they cannot reach each other directly. It can never read session content.
_Avoid_: relay (alone, when the push relay could be meant), tunnel, bridge, proxy

**Home relay**:
The one connection relay a daemon has chosen to stay connected to, announced to its devices; devices reach the daemon's relay path through it.
_Avoid_: region, default relay

**History cache**:
A device's encrypted, read-only copy of a computer's conversations, synced forward from the daemon, which stays the source of truth.
_Avoid_: offline mode, local database, outbox

**Push relay**:
The project-hosted service that delivers push notifications on behalf of daemons that have no push credentials of their own. It carries notifications only, never a session's traffic.
_Avoid_: relay (alone, when the connection relay could be meant)

### Permissions

**Always-allow rule**:
A permission rule in an agent's settings that approves matching tool calls without asking again.
_Avoid_: permanent permission, whitelist

**App-created rule**:
An always-allow rule written because a device answered "allow always"; the daemon remembers it and any device can undo it.
_Avoid_: phone rule

**Hand-written rule**:
An always-allow rule the user wrote on the computer; devices see it and may delete it only from settings, never edit it.
_Avoid_: manual rule, user rule

**Approval log**:
The daemon's record of every Allow and Deny answered from a device: which device, session, tool and short sanitized target, and when; never the tool input.
_Avoid_: audit trail, history (that is the history cache)
