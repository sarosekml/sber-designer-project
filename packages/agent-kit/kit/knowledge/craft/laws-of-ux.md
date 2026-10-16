# Laws Of UX Craft Guidance

Apply these heuristics as review questions, not as universal geometry. Project
components and the actual workflow remain the source of truth.

## Guidance Rules

- id: craft.ux.target-size
- severity: should-fix
- mode: guidance
- intent: Frequent and important actions should be easy to acquire without
  making every control visually dominant.
- guidance: Use the project's control sizes and provide a comfortable hit area,
  especially for icon-only, row, and touch actions.

- id: craft.ux.choice-load
- severity: advisory
- mode: guidance
- intent: A screen should expose the next useful choices without presenting all
  possible actions at equal priority.
- guidance: Keep the primary action visible, group secondary actions, and move
  rare or destructive operations into a predictable overflow surface.

- id: craft.ux.proximity-grouping
- severity: should-fix
- mode: guidance
- intent: Spacing and containment should make relationships understandable
  before color or decoration is applied.
- guidance: Keep labels with their controls, actions with the content they
  affect, and unrelated groups separated by a larger token-backed interval.
