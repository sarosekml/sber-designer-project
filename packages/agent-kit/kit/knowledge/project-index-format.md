# Project Index Format

The unified project index lives in `.sber-designer/design-index/`.

Canonical files:

- `manifest.json`: version, generation time, source flags, counts, artifact paths.
- `project-profile.json`: framework, package manager, aliases, source roots, styling.
- `prompt-summary.md`: compact context block for `ai-product-designer`.
- `design-brief.md`: human-readable design-system brief and optional `DESIGN.md` export source.
- `components.jsonl`: component records, stories, groups, confidence, notes count.
- `component-groups.json`: product-job groups for tables, forms, navigation, status, layout, charts.
- `tokens.json`: token records from `DESIGN.md`, CSS variables, Tailwind, theme files, design brief.
- `icons.json`: project icons plus controlled Lucide fallback vocabulary.
- `assets.jsonl`: project icons, illustrations, and images imported or stored under project asset roots.
- `routes.json`: route/page discovery.
- `screens.jsonl`: screen implementation/story candidates and Design-readable status hints.
- `storybook.json`: Storybook config detection and story glob assumptions.
- `usage-examples.jsonl`: examples from stories, descriptions, and enrichment.
- `agent-notes.jsonl`: project-specific AI notes and migrated legacy component map guidance.
- `diagnostics.json`: missing, stale, ambiguous, or unsupported project context.
- `fingerprints.json`: tracked files for stale detection.

Enrichment rules:

- Never write outside `.sber-designer/design-index/*` during background indexing.
- Never overwrite deterministic facts unless the runner explicitly supports that field.
- Keep notes tied to concrete targets: component id, screen id, token id, icon id, asset id, or project.
- Diagnostics should help the user decide whether to add docs, run Storybook, or improve indexability.
- Generated or repaired screens should move toward Design-readable structure consumed by Design mode.
