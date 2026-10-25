## Context

`expo-alternate-app-icons` declares one `<activity-alias>` per icon targeting `.MainActivity` and switches icons by enabling the new alias and disabling the current component (`DONT_KILL_APP`). It copies `android.intentFilters` into the aliases, but Expo adds the scheme filter straight to `MainActivity` in the manifest, so the aliases miss it. On an API 37 emulator, disabling the component the task was launched through removes the task even with `DONT_KILL_APP` — for an alias as well as for `MainActivity` itself.

React Native reports `background` on `onHostPause`, so a translucent permission dialog (e.g. the camera prompt on the pairing screen) already counts as background.

## Goals / Non-Goals

**Goals:** deep links resolve with any icon; the icon never changes while the user is still in the app.

**Non-Goals:** keeping the task in Recents across a switch (the platform removes it; the app reopens from its icon); changing iOS behavior.

## Decisions

- **Copy `MainActivity`'s filters into the aliases in a manifest mod** applied before the `plugins` list, so it runs after both the scheme mod and the library's alias mod. Idempotent: an alias keeps its launcher filter and its other filters are replaced. Alternative — declaring the scheme filter in `android.intentFilters` — would duplicate it on `MainActivity` and depend on the library's internals.
- **Leave signal from `MainActivity`**: `onUserLeaveHint` marks the user leaving unless the activity started an activity of its own since it was last resumed (tracked in `startActivityForResult`, which `startActivity` and Expo's result launchers go through); the event is emitted from `onStop`, so a permission dialog (pause only) never fires it, and turning the screen off gives no hint. Alternatives: `AppState` background (fires on dialogs — the bug); `onStop` alone (fires for the camera/picker and screen off); making "Original" an alias too so `MainActivity` is never disabled (tested: disabling an alias also removes the task, so it would not help).

## Risks / Trade-offs

- [A pending change waits until the user next presses Home/Recents; leaving with Back does not apply it] → it is applied on a later leave; the icon is cosmetic.
- [An activity started through another path (e.g. `startIntentSenderForResult`) followed by stop would count as leaving] → none is used by the app today.
- [Returning from Recents after a switch reopens the app from scratch] → inherent to Android alias switching; already noted in the spec.

## Migration Plan

Native change: ships with the next store build. Existing installs keep their enabled alias; it gains the deep link filters on update.
