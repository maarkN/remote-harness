## Why

`remote-harness devices list` prints one unaligned line per device, with no header and the labels repeated in every row ("paired 2026-10-31 01:16  last seen …  app ?"), so with four devices the columns are hard to read (#618).

## What Changes

- `devices list` prints a table:
  - a header row (ID, name, platform, paired, last seen, app), in the CLI's language;
  - one row per device, with columns padded by display width, so names with accents, wide characters or emoji keep the columns after them aligned.
- Rows are sorted with the most recently seen device first. Devices never seen come last, newest pairing first.
- "—" replaces "?" for an unknown app version, and stands for an empty name or platform too.
- A small pure text-table helper in the daemon (`core/text-table.ts`): the display width of a string, padding to it, and rendering rows into aligned columns. It is ready for other CLI lists.
- i18n: the column headers in pt-BR, en-US and es-ES replace the old `row` text.
- Tests:
  - display width: ASCII, composed and decomposed accents, emoji with and without variation selectors, ZWJ sequences, CJK;
  - the table: header, alignment, no trailing spaces;
  - the device rows: order, unknown values, long names, the three languages.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `daemon-auth`: "Paired devices", for how `remote-harness devices list` prints the list.

## Impact

- Daemon:
  - `core/text-table.ts` (new);
  - `features/pairing/devices-table.ts` (new, the rows for the CLI);
  - `cli.ts` (`devices list`);
  - the i18n catalogs (`cli.devices.columns` in place of `cli.devices.row`);
  - tests.
- No protocol, app or tray change. Times stay as `devices list` printed them.
