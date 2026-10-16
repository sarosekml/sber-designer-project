# Dashboard Page Template

Use for analyst workspaces and portfolio overview screens.

- Wrap the screen in `AppShell` and pass a stable `screenId` that matches `.sber-designer/project.sdproj`.
- Start with `PageHeader`: concise title, one-line subtitle, and page-level actions.
- Place 3 KPI cards above the main content when the screen summarizes a domain.
- Use `demo-content-grid` for a primary content column and a right rail.
- Reuse `KpiCard`, `AssetsTable`, `InvestmentReportCard`, `IdeaCard`, `ChangesCard`, and `InteractionHistory`.
- Do not create new button, badge, table, or card markup when a catalog component covers the need.

## Generated-screen convention

- Build new screens from Storybook catalog components and page patterns first.
- Put editable generated implementations in `src/screens/investment-crm/`.
- Keep `src/stories/screens/investment-crm/...` as a thin Storybook wrapper that only imports the implementation and exports `Default`.
- Use local layout utility classes only for spacing and grids; do not treat any screen folder as a protected design-system folder.
