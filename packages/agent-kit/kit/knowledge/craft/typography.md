# Typography And Structure Craft Rules

Use this reference for hierarchy and reusable structure. The current
screen-craft implementation enforces the reusable-structure subset through the
component pack.

## Rules

- id: craft.raw-font-family
- severity: should-fix
- mode: enforced
- intent: HTML design-system screens should not set a raw font-family literal
  when the project ships connected typography tokens.
- guidance: Reference project typography tokens such as `var(--font-sans)` from
  tokens.css instead of naming font stacks inline. Enforced as blocking only
  when the HTML design system (Design.md + tokens.css + components.css) is
  connected.

- id: craft.component-family.missing-data-table
- severity: should-fix
- mode: enforced
- intent: Dense row/list workflows should use an available table or list family
  component instead of hand-rolled rows.
- guidance: Use the task-relevant component pack's data-table candidate or
  explain why the indexed component is incompatible.

- id: craft.component-reuse.design-system-gap
- severity: blocking
- mode: enforced
- intent: A required structure-plan role without a selected project component
  must trigger one bounded readiness repair rather than a raw substitute.
- guidance: Retrieve one focused project component, hydrate its usage card,
  update the run-local selection, repair the source, and validate once.

- id: craft.component-reuse.missing-breadcrumb
- severity: should-fix
- mode: enforced
- intent: Navigation trails should use the indexed breadcrumb component when
  the task and pack expose one.
- guidance: Reuse the project breadcrumb candidate rather than recreating links.

- id: craft.component-reuse.missing-page-header
- severity: should-fix
- mode: enforced
- intent: Page title/action regions should reuse an indexed page-header
  component when available.
- guidance: Use the page-header candidate for title, status, and primary action
  alignment.

- id: craft.component-reuse.missing-section-header
- severity: should-fix
- mode: enforced
- intent: Repeated section headers should use the indexed section-header
  pattern when available.
- guidance: Keep hierarchy consistent by reusing the section header candidate.

- id: craft.component-reuse.missing-tile
- severity: should-fix
- mode: enforced
- intent: Content panels should reuse indexed panel/tile/card primitives when
  the component pack offers one.
- guidance: Use the content-panel candidate before creating ad hoc wrappers.

- id: craft.component-reuse.optional-candidate-unused
- severity: advisory
- mode: enforced
- intent: An unused optional shortlist candidate is diagnostic context and must
  not fail an otherwise ready screen.
- guidance: Keep the candidate skipped when it does not serve a required region;
  do not add it only to improve shortlist coverage.

- id: craft.component-reuse.required-component-missing
- severity: blocking
- mode: enforced
- intent: A component explicitly required by the user's instruction or
  structured brief must appear in the generated source.
- guidance: Use the exact indexed component requested by the user. A related
  primitive or family member is not an acceptable substitute.

## Guidance

- mode: guidance
- intent: Match the heading scale to the surface. Compact dashboards and forms
  should not use hero-scale type inside panels or sidebars.
