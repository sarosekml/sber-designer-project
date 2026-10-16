# Form Validation Craft Rules

Forms must explain what is required, preserve entered values, and provide a
clear recovery path when validation fails.

## Rules

- id: craft.form.missing-error-state
- severity: should-fix
- mode: enforced
- intent: A form with required fields needs an explicit recoverable validation
  error state.
- guidance: Render field-level error copy, connect it with `aria-invalid` and
  `aria-describedby`, preserve the user's input, and allow correction.

## Guidance Rules

- id: craft.form.required-marker
- severity: should-fix
- mode: guidance
- intent: Required and optional fields should be distinguishable before submit.
- guidance: Follow the project form convention for required markers and include
  the requirement in the accessible name or description.

- id: craft.form.submit-state
- severity: should-fix
- mode: guidance
- intent: Submit controls should communicate disabled and in-progress behavior
  without trapping the user in an unexplained state.
- guidance: Explain why submit is unavailable when useful, prevent duplicate
  submission, and keep server errors visible near the affected fields.
