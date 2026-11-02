## Why

With the app open nothing announces what happens in the other sessions: the daemon skips every push while a foreground client is connected, and the app's notification handler shows no banner on purpose, so a turn that finishes, a permission request, a question or a plan review in a session other than the one on screen only changes the list quietly while the user keeps waiting on the session they are looking at (#472).

## What Changes

- An in-app notice for those four events when they happen in a session other than the one on screen: a banner at the top with what happened and the session's title; tapping it opens the session, a newer notice replaces the one shown, and it goes away on its own after a few seconds or when dismissed.
- Built from what the app already receives (`session.updated` / `session.changed` for a finished turn, `permission.request` for permissions, questions and plans): no daemon or protocol change.
- Nothing for muted profiles or sessions, nothing for the session on screen, nothing for requests replayed on reconnect, nothing in the offline demo. The haptic of a finished turn follows the per-phone push toggle (a sound waits for #134, distinct sounds).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-shell`: new requirement "In-app notices" (the banner, when it shows and when it does not).

## Impact

- `apps/mobile/src/features/notices/` (pure selector with tests, store, hook, banner component), the main layout mounts the hook and the banner; i18n in pt-BR, en-US and es-ES.
