# Data Density Craft Rules

Operational tables should support fast comparison and scanning. Dense does not
mean cramped: the project density variant, column roles, and interaction model
should stay consistent.

## Rules

- id: craft.data-table.numeric-alignment
- severity: should-fix
- mode: enforced
- intent: Numeric table columns need explicit end alignment so magnitudes can be
  compared vertically.
- guidance: Right/end-align numeric headers and cells, use tabular numerals when
  available, or use the indexed table component's numeric-column API.

## Guidance Rules

- id: craft.data-table.scan-order
- severity: should-fix
- mode: guidance
- intent: Column order and density should reflect the user's scanning task.
- guidance: Lead with identity, group related dimensions, keep statuses compact,
  and place row actions predictably at the edge.

- id: craft.data-table.controls
- severity: should-fix
- mode: guidance
- intent: Large datasets need discoverable sorting, filtering, pagination or
  virtualization, and empty/loading/error behavior.
- guidance: Reuse the indexed table family and its density/control variants;
  avoid rebuilding those behaviors with arbitrary row markup.
