## 1. Text table

- [x] 1.1 Tests first in `test/text-table.test.ts`:
  - `displayWidth`: ASCII, composed and decomposed accents, CJK (2 each), emoji (2), a keycap or VS16 emoji, a ZWJ family (2), combining marks (0).
  - `renderTable`: the header and rows padded to the widest cell per column, two spaces between columns, no trailing spaces.

  Verify they fail.
- [x] 1.2 `core/text-table.ts`: `displayWidth` over grapheme clusters (`Intl.Segmenter`), plus `padDisplay` and `renderTable`. Verify the tests in 1.1 pass.

## 2. Devices list

- [x] 2.1 Tests first in `test/devices-table.test.ts`. `devicesTableRows(devices, labels)` gives:
  - the header in the given language;
  - rows ordered by last seen, newest first, with never-seen devices last by pairing time;
  - "—" for an unknown app version, name or platform;
  - times as `YYYY-MM-DD HH:MM`.

  A long name and an emoji name keep the columns aligned, and the three languages work.

  Verify they fail.
- [x] 2.2 `features/pairing/devices-table.ts` and `cli.devices.columns` in the three catalogs (replacing `row`). `devices list` prints the rendered table and keeps the empty text. Verify the tests in 2.1 and the i18n parity tests pass.

## 3. Verification

- [x] 3.1 `pnpm check` green (typecheck, tests, Biome with warnings as errors). Locally the Go relay is left out, because there is no Go toolchain on this Mac.
- [x] 3.2 On this computer: `devices list` from this branch's CLI (`tsx src/cli.ts devices list`) prints the six real paired devices as an aligned table in pt-BR (the `config.json` language), most recently seen first; en-US and es-ES are covered by the tests.
