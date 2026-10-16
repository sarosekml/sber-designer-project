# Color Craft Rules

Use project tokens, indexed CSS variables, or token-backed utility classes for
screen colors. Raw literals are acceptable only when no project color system is
indexed and the final response calls out the gap.

When the HTML design system is connected (Design.md + tokens.css +
components.css present), the "do not invent a palette" contract is enforced:
raw hex colors, default utility palettes, and raw font-family literals become
blocking findings that send the run to needs_review. Use only tokens.css
values and components.css classes.

## Rules

- id: craft.raw-hex
- severity: should-fix
- mode: enforced
- intent: Screens should not introduce raw hex colors when project tokens exist.
- guidance: Map raw color values to project tokens, CSS variables, or
  token-backed classes from the current design index. When the HTML design
  system is connected, this is blocking: do not invent a palette, use only
  tokens.css values.

- id: craft.default-palette
- severity: should-fix
- mode: enforced
- intent: HTML/CSS profile screens should not import anonymous default utility
  palette classes when the project has indexed CSS tokens or catalog classes.
- guidance: Use project CSS classes or `var(--...)` custom properties instead
  of default palette utility names. Blocking when the HTML design system is
  connected.

## Guidance

- mode: guidance
- intent: When translating an image reference, match the color role first
  (surface, text, accent, status) and only then choose the closest token.
