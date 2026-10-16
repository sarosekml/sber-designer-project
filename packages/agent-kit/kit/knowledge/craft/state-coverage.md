# State Coverage Craft Rules

Data-heavy screens need explicit non-happy-path states. A generated first pass
may be compact, but it should show where empty, loading, and error states live.

## Rules

- id: craft.missing-state
- severity: should-fix
- mode: enforced
- intent: Tables, lists, grids, and data regions need empty/loading/error state
  coverage or a project component that owns those states.
- guidance: Add visible states or route state handling through the indexed
  component API.

## Guidance

- mode: guidance
- intent: Prefer state copy that helps the user recover: what happened, why it
  matters, and the next available action.
