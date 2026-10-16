# Project screen templates

Project-owned layout recipes for the `Add a screen` dialog, in the
`*.screen.md` format (see task `0097` in the sber-designer repo). These live in
the project so they are git-reviewable and shared across the team. They may name
**real ibp-ui-kit components** (unlike the universal built-ins).

The resolver reads only `*.screen.md` files here; this README is ignored.

| File | Screen | Use it for |
|---|---|---|
| `table.screen.md` | Payment schedule / register | A full page that is one dense, sortable table with a totals + pagination footer. |
| `cards.screen.md` | Payment detail | One record's facts as a uniform grid of read-only label/value info cards. |
| `cards-deal.screen.md` | DCM/ECM deal page | Rich deal overview: mixed-height cards with header actions, badges, progress, and an embedded mini-table. |
| `cards-links.screen.md` | Administration hub | Navigation index: labelled columns of cards holding grouped link lists. |

`cards` vs `cards-deal`: pick `cards` for plain read-only fact cards; pick
`cards-deal` when cards need per-card actions (→ navigate / ✎ edit), counters,
progress, or an embedded table.

Built-in universal templates (`dashboard`, `list-table`, `detail`, `form`,
`settings`) still appear in the dialog alongside these.
