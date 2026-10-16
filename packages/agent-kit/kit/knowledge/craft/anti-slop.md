# Anti-Slop Craft Rules

Use these rules to keep generated product screens honest, specific, and
workflow-shaped. Rules are role-based and must be satisfied with the connected
project's indexed tokens, components, source files, and task data.

## Rules

- id: craft.source-missing
- severity: blocking
- mode: enforced
- intent: A craft pass without a resolvable source file is not valid evidence.
- guidance: Register or repair the screen implementation path before reporting
  the screen as complete.

- id: craft.fake-metric
- severity: blocking
- mode: enforced
- intent: Do not invent business metrics, money amounts, percentages, or counts.
- guidance: Use bound data, remove the metric, or label BRD/sample/mock data
  explicitly when the value is illustrative.

- id: craft.card-soup
- severity: advisory
- mode: enforced
- intent: Repeated generic cards should not replace a real workflow surface.
- guidance: Prefer tables, forms, comparison regions, step flows, or project
  layout primitives when the task is operational.

- id: craft.marketing-hero
- severity: advisory
- mode: enforced
- intent: Operational product screens should not read like landing pages.
- guidance: Use task-focused headings, filters, statuses, and actions instead
  of promotional hero copy.

- id: craft.placeholder-asset
- severity: should-fix
- mode: enforced
- intent: Generated HTML/CSS screens should not depend on placeholder image
  services or placeholder filenames.
- guidance: Use indexed project assets, reviewable generated assets, or remove
  purely decorative placeholder media.

- id: craft.modal.missing-window
- severity: blocking
- mode: enforced
- intent: A modal screen must carry a marked dialog window so its size and
  presentation are managed.
- guidance: Wrap the dialog in an element marked `data-sd-modal-window` that
  carries the size custom properties.

- id: craft.modal.missing-body-region
- severity: blocking
- mode: enforced
- intent: A modal needs a marked scrolling body region so long content scrolls
  while the header and footer stay put.
- guidance: Mark the elastic content region with `data-sd-modal-region="body"`.

- id: craft.modal.size-not-in-contract
- severity: blocking
- mode: enforced
- intent: A modal's size should live in the contract variables so it stays
  editable from the Design panel.
- guidance: Set `--sd-modal-width` / `--sd-modal-height` inline on the marked
  window instead of a hardcoded width or height.

- id: craft.modal.ambiguous-window
- severity: blocking
- mode: enforced
- intent: Modal source must expose exactly one managed dialog window.
- guidance: Keep one rendered `data-sd-modal-window`; marker-like comments and
  strings do not count.

- id: craft.modal.backdrop-root
- severity: blocking
- mode: enforced
- intent: The single modal backdrop must also be the screen root.
- guidance: Put `data-sd-screen-root` and `data-sd-modal-backdrop` on the same
  viewport wrapper.

- id: craft.modal.non-forwarding-window
- severity: blocking
- mode: enforced
- intent: The managed marker must reach a real DOM dialog-content element.
- guidance: Use a native element or a known DOM-forwarding DialogContent
  primitive.

- id: craft.modal.content-mode
- severity: blocking
- mode: enforced
- intent: Long-content behavior must be explicit and editable.
- guidance: Set `data-sd-modal-content="scroll"` or `"grow"` on the window.

- id: craft.modal.region-contract
- severity: blocking
- mode: enforced
- intent: A modal has one body and at most one header/footer region.
- guidance: Keep modal region markers unique and structural.

- id: craft.modal.accessibility
- severity: blocking
- mode: enforced
- intent: Modal semantics and an accessible name are mandatory.
- guidance: Add dialog/alertdialog role, `aria-modal="true"`, and
  `aria-label` or `aria-labelledby`.

- id: craft.modal.scroll-contract
- severity: blocking
- mode: enforced
- intent: Scroll mode keeps header/footer pinned and scrolls only the body.
- guidance: Use an elastic `min-height: 0` body with `overflow-y: auto` inside
  a clipping window.

- id: craft.modal.grow-contract
- severity: blocking
- mode: enforced
- intent: Grow mode expands the window and scrolls the backdrop when needed.
- guidance: Remove the window max-height, expose body overflow, and make the
  backdrop vertically scrollable.

- id: craft.modal.opaque-host
- severity: blocking
- mode: enforced
- intent: An overlay preview host must not hide its live underlay.
- guidance: Keep html/body/Storybook host transparent; the backdrop owns scrim.

- id: craft.modal.page-surface-mismatch
- severity: blocking
- mode: enforced
- intent: Page metadata must not retain the managed modal layout contract.
- guidance: Complete modal-to-page source conversion or restore modal metadata.

## Guidance

- id: craft.language-fact-fidelity
- severity: should-fix
- mode: guidance
- intent: Generated UI must keep the language and key business facts of the
  user's brief or specification unless translation is explicitly requested.
- guidance: Preserve names, amounts, dates, identifiers, and status labels
  verbatim. Keep ambiguous source wording and report the uncertainty instead of
  anglicizing, translating, or inventing replacement facts.

- mode: guidance
- intent: If the screen is intentionally exploratory, mark the uncertain data
  and assumptions in the final response instead of hiding them in polished copy.
