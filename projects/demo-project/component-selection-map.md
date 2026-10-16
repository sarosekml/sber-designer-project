# Component selection map

This file is kept only as a compatibility note for older sber-designer runs.

The canonical agent context now lives in `.sber-designer/design-index/`:

- `components.jsonl` and `component-groups.json` for component choice.
- `screens.jsonl` for editable screen implementation paths.
- `agent-notes.jsonl` for project and component guidance.
- `prompt-summary.md` for compact prompt context.

For presentation screens, edit `src/screens/investment-crm/*Screen.tsx` and keep Storybook files under `src/stories/screens/investment-crm/` as thin wrappers.
