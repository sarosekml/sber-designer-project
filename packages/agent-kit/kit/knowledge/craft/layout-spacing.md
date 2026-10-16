# Layout And Spacing Craft Rules

Use the project's indexed spacing tokens, layout primitives, and real screen
patterns to create a visible rhythm. Density can vary by surface, but alignment
and spacing increments should remain deliberate and repeatable.

## Guidance Rules

- id: craft.layout.token-spacing
- severity: should-fix
- mode: guidance
- intent: Repeated spacing values should come from project tokens or established
  layout classes instead of an invented local scale.
- guidance: Reuse indexed gap, inset, and container tokens. Introduce a new
  value only when the existing scale cannot express the required relationship.

- id: craft.layout.alignment-rhythm
- severity: should-fix
- mode: guidance
- intent: Related regions should share alignment lines and a consistent vertical
  rhythm across headings, controls, and data surfaces.
- guidance: Align section edges, labels, actions, and table boundaries to the
  same grid before adding decorative separation.

- id: craft.layout.responsive-regions
- severity: advisory
- mode: guidance
- intent: Responsive behavior should preserve information priority instead of
  merely shrinking the desktop composition.
- guidance: Define which regions wrap, stack, scroll, collapse, or remain sticky
  at the project breakpoints exposed by the design index.
