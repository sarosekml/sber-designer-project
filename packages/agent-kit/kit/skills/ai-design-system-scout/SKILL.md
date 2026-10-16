---
name: ai-design-system-scout
description: Turn a screenshot, Pixso link, or reference URL into a reviewable nine-section project style-contract proposal.
compatibility: sber-designer
sd:
  profile:
    - react-storybook
    - react
    - html-css
---

# AI Design System Scout

Use this skill when the user wants to derive a project style contract from a
visual reference. The output is a proposal for human review, never an immediate
replacement of the active project design system.

## Load first

Call `read_agent_knowledge` for these ids before following the runbook:

- `project-index-anatomy`
- `catalog-response-shape`
- `frontend-ui-rules`
- `product-ui-patterns`

## When to use vs when to defer

Use this skill when:

- the input is an attached screenshot or image, a Pixso link, or another
  reference URL;
- the user asks to extract, scout, draft, or propose visual-system rules;
- the result must be reviewed before it becomes the active `Design.md` or
  `DESIGN.md`.

Defer to another skill when:

- repeated values must be mined from existing HTML pages; use
  `design-system-distill`;
- the user only asks which existing token or component to use; use
  `design-system-context`;
- an accepted design system must be applied to screens; use the screen
  generation, redesign, or visual editing flow as appropriate.

## Safety and evidence rules

- Treat the reference as evidence, not as source text to copy.
- Do not write root `Design.md`, root `DESIGN.md`, production screen files, or
  active component files during scouting.
- Write only inside the exact `design/proposals/<proposal-id>/` target supplied
  by the request.
- Accept copies proposal `tokens.css` and `components.css` over the canonical
  runtime files. Create either optional CSS file only when it is an
  activation-safe, complete replacement that preserves required imports and
  existing runtime contracts. Otherwise omit it and record the evidence in
  `Design.md` or `extraction-report.md`.
- Do not invent inaccessible URL content. If the runtime cannot inspect a URL,
  record that limitation in `extraction-report.md` and stop before claiming the
  proposal is ready.
- Separate observed facts from inferred roles. Mark every uncertain color,
  font, spacing value, component pattern, or responsive rule as low confidence.
- Prefer existing project token names and component roles when the project
  index proves they match the reference. Never hardcode another project's
  component names or imports.

## Required proposal bundle

Create these project-owned draft files:

```text
design/proposals/<proposal-id>/
  Design.md
  extraction-report.md
  tokens.css              # optional; evidence-backed values only
  components.css          # optional; repeated patterns only
  design-system.html      # optional preview when requested
```

`Design.md` must contain all nine sections in this exact order:

1. Visual Theme & Atmosphere
2. Color Palette & Roles
3. Typography Rules
4. Component Stylings
5. Layout Principles
6. Depth & Elevation
7. Do's and Don'ts
8. Responsive Behavior
9. Agent Prompt Guide

Every section needs actionable content. Do not leave placeholder headings.

## Runbook

1. Confirm the exact proposal target and the available reference evidence.
2. Read the compact project index and current project style contract when they
   exist. Use them to identify reusable names and conflicts, not to overwrite
   what is visible in the reference.
3. Inspect the attachment or design-tool source. For a web URL, use only content
   the runtime can actually access.
4. Record observations for palette roles, typography, density, spacing,
   layout, depth, components, responsive behavior, and accessibility.
5. Label each observation as direct evidence or inference and give uncertain
   items a short review question.
6. Draft the complete nine-section `Design.md` in the supplied proposal path.
7. Add semantic CSS tokens only for concrete values supported by the evidence.
8. Add component classes only for patterns that repeat or have a clear reusable
   role.
9. Write `extraction-report.md` with source identity, observed evidence,
   assumptions, confidence, conflicts with the current project, omitted values,
   and human review questions.
10. Do not activate the proposal. Finish by telling the user to review and use
    the product Accept or Reject action.

## Completion contract

A proposal is ready for review only when:

- all nine `Design.md` sections are present, non-empty, unique, and ordered;
- `extraction-report.md` identifies the evidence and low-confidence decisions;
- every proposed CSS value is traceable to evidence;
- no active design-system or production screen file was changed.
