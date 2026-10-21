## Why

Issue #324: in the `QUEUED · N` card above the composer, each queued row has Edit, Send now and Remove as three 16pt icon buttons side by side. Send now and Remove sit right next to each other, so it is easy to mis-tap and remove a queued message when the intent was to send it now. Removing is destructive and cannot be undone.

## What Changes

- The queue row's actions move to two lines: Remove sits alone at the row's top-right corner (a small dismiss "×", away from the text); Edit and Send now sit at the row's bottom-right, with Send now last and styled as a filled accent button so it reads as the primary action. A full row now separates Remove from Send now instead of them sharing an edge.
- `IconButton` gains an optional `filled` variant (accent background, `accentInk` icon) for Send now; its hit area was already ≥44×44pt via existing padding and `hitSlop`, so that is unchanged.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `app-conversation`: queue card row layout keeps Remove and Send now apart.

## Impact

`apps/mobile/src/ui/IconButton.tsx` (`filled` prop), `apps/mobile/src/features/queue/components/QueueCard.tsx` (row layout). No protocol, daemon or i18n key change — only layout.
