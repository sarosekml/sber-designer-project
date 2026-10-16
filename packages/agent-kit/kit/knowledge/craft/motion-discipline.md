# Motion Discipline Craft Guidance

Apply this reference only when the connected project exposes motion tokens or
established animated component states. No motion system means no invented one.

## Guidance Rules

- id: craft.motion.token-only
- severity: should-fix
- mode: guidance
- intent: Duration and easing should come from project motion tokens or an
  existing component behavior.
- guidance: Reuse indexed motion values and keep transitions tied to state
  change, spatial continuity, or feedback.

- id: craft.motion.reduced-motion
- severity: should-fix
- mode: guidance
- intent: Non-essential movement should respect reduced-motion preferences.
- guidance: Remove or shorten decorative movement under `prefers-reduced-motion`
  while preserving state and progress communication.

- id: craft.motion.restraint
- severity: advisory
- mode: guidance
- intent: Motion should clarify cause and effect rather than decorate every
  interaction.
- guidance: Avoid perpetual, layout-shifting, or competing transitions; use one
  clear motion cue for the state change that needs attention.
