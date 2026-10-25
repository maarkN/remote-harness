## Why

Every time the app opens on iOS, the system shows several "You have changed the icon for Remote Harness" alerts in a row (#345). The root layout starts the app icon effect before the saved preferences are back: it first sees the defaults ("Match theme" and the store's initial dark scheme), then the restored theme, then the restored icon preference, and every step that resolves to an icon different from the current one calls `setAlternateAppIcon`, which shows an alert each time.

## What Changes

- The theme store and the app icon store record when their saved preference has been read (`restored`), whether a value was saved or not.
- A pure helper decides which icon to apply, if any: nothing until both preferences are restored, nothing when the target is already the current icon or the one this launch already asked for, otherwise the target.
- `useApplyAppIcon()` uses it on iOS and Android alike, so opening the app with an unchanged preference changes nothing and a real change (preference or resolved theme) asks once.
- The theme store's initial system scheme comes from `Appearance.getColorScheme()` instead of a fixed `dark`, so the first resolved theme is already the phone's.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `app-shell`: "App icon follows the theme" gains that the icon is applied only once the saved preferences are read, never at launch when nothing changed.

## Impact

`apps/mobile/src/features/settings/{app-icon.ts,app-icon-store.ts,app-icon.test.ts}`, `apps/mobile/src/core/theme/store.ts`. No protocol, daemon or native change.
