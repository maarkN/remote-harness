## Why

Issue #326: when the paired computer cannot be reached (turned off, asleep, Tailscale disconnected on either side), the only feedback is the thin `ConnectionBanner` strip. The session list just shows nothing, or a stale cached list with no explanation. The user is not told what to check or how to fix it.

## What Changes

- A new "computer unreachable" state replaces the empty session list (and the iPad detail pane) while the client is `reconnecting` and `unreachable` and there is nothing live to show: a title, a checklist of what to check (computer awake, Tailscale on both sides, the daemon running), **Try again** (`client.resumeNow()`, skipping the backoff wait), **Open Tailscale** (its own URL scheme, falling back to the store listing) and a link to the troubleshooting guide, plus a reconnecting indicator.
- When a stale session list from an earlier fetch is still available, it stays visible with a compact "offline list from {{time}}" notice and a **Try again** action above it, instead of the full checklist.
- `useSessionsStore` gains `lastFetchedAt`, set on every snapshot, to show that notice. A new pure `unreachableView(status, unreachable, hasSessions)` decides which of the two (or neither) applies — reusing the same `reconnecting && unreachable` signal the existing banner already uses, so a token rejection or a brief reconnect never triggers either.
- `apps/web/content/*/troubleshooting.md` gains a section listing the same checks, in the three languages.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `app-session-list`: the empty state and the iPad detail pane while the computer is unreachable.

## Impact

`apps/mobile/src/features/sessions/{store,unreachable}.ts` (+ test), `apps/mobile/src/features/sessions/components/{UnreachableEmptyState,UnreachableNotice}.tsx`, `apps/mobile/src/features/sessions/SessionsScreen.tsx`, `apps/mobile/src/app/(main)/index.tsx`, `apps/mobile/src/features/pairing/setup-guide.ts` (`TAILSCALE_APP_SCHEME`), i18n (pt-BR, en-US, es-ES), `apps/web/content/*/troubleshooting.md`. No protocol or daemon change.
