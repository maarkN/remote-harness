## Why

On Android the session screen's header shows nothing on the right: the notifications bell, the terminal button, the tablet layout's inspector button and the More options menu are missing, so the terminal, hands-free and the session options cannot be reached from the header (issue #479). `headerActions()` builds the options with `unstable_headerRightItems`, the native bar-button items API that Expo Router 57 marks iOS-only; Android ignores it and renders no right header slot. Found while taking the store screenshots on an Android emulator; it affects every Android build since the header moved to that API.

## What Changes

- `apps/mobile/src/ui/header-actions.tsx` returns the classic `headerRight` option outside iOS, and keeps the native items with the shared "liquid glass" background turned off on iOS. No visual change on iOS; Android gets the same actions as iOS.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-conversation`: the header actions are shown on every platform, not only on iOS.

## Impact

`apps/mobile/src/ui/header-actions.tsx` only; its single caller is the session screen (`apps/mobile/src/app/(main)/session/[id]/index.tsx`). No protocol, daemon or i18n change.
