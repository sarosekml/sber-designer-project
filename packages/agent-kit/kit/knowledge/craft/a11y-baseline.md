# Accessibility Baseline Craft Rules

Generated screens should preserve basic accessibility and valid React source
shape. These checks are intentionally small and deterministic.

## Rules

- id: craft.icon-button-label
- severity: blocking
- mode: enforced
- intent: Icon-only controls need an accessible name.
- guidance: Add `aria-label`, `aria-labelledby`, `title`, or visible text.

- id: craft.emoji-icon
- severity: should-fix
- mode: enforced
- intent: Emoji and plain symbols should not stand in for product UI icons.
- guidance: Use project icon assets, inline SVG from the icon catalog, or an
  accessible text label.

- id: craft.react-hook-outside-component
- severity: blocking
- mode: enforced
- intent: React hooks must not run at module scope or inside non-component
  helpers.
- guidance: Move hooks into PascalCase components or custom hooks, or replace
  static derivations with plain constants.

## Guidance

- mode: guidance
- intent: Prefer semantic elements and project controls before adding ARIA;
  ARIA should describe behavior, not compensate for broken structure.
