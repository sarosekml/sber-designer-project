# Detail Page Template

Use for fund, asset, idea, and analysis detail screens.

- Start with `Breadcrumbs`, then `PageHeader`.
- Use a hero `Card` for the entity summary, status, owners, and primary metadata.
- Add `Tabs` when the entity has overview/documents/risks/history sections.
- Use `demo-two-col` or `demo-content-grid` for body composition.
- Use catalog badges, tags, avatars, cards, and buttons for all controls and metadata chips.
- Keep AI-generated summaries in cards with clear source or confidence labels.

## Generated-screen convention

- Build new screens from Storybook catalog components and page patterns first.
- Put editable generated implementations in `src/screens/investment-crm/`.
- Keep `src/stories/screens/investment-crm/...` as a thin Storybook wrapper that only imports the implementation and exports `Default`.
- Use local layout utility classes only for spacing and grids; do not treat any screen folder as a protected design-system folder.
