## 1. Sheet layout

- [x] 1.1 In `SessionDetailsSheet.tsx`, replace the backdrop `Pressable` wrapping a sheet `Pressable` with a container `View` (dimmed, content at the bottom) holding a backdrop `Pressable` over the whole modal (`StyleSheet.absoluteFill`, `onPress={onClose}`, not exposed to accessibility since the Close button is) and the sheet as a plain `View` on top of it.
- [x] 1.2 Check `SessionDetailsList`: rows are plain `View`s, values are selectable `Text`, the only `Pressable` is the Copy button; nothing else claims the responder (no change needed if so).

## 2. Verification

- [x] 2.1 `pnpm check` green.
- [x] 2.2 `npx expo export --platform ios` bundles.
