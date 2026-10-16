# List Page Template

Use for assets, funds, communications, search, and other index screens.

- Wrap the screen in `AppShell` and pass a stable `screenId` that matches `.sber-designer/project.sdproj`.
- Use `PageHeader` with import/export/add actions when relevant.
- Add `Tabs` below the header for major list states.
- Add a filter bar with `SearchField` and `SegmentedControl`.
- Use table or row components from the catalog; do not hand-roll repeated rows unless no component exists.
- Keep empty, loading, and error states in the same card region as the list they replace.

## Generated-screen convention

- Build new screens from Storybook catalog components and page patterns first.
- Put editable generated implementations in `src/screens/investment-crm/`.
- Keep `src/stories/screens/investment-crm/...` as a thin Storybook wrapper that only imports the implementation and exports `Default`.
- Use local layout utility classes only for spacing and grids; do not treat any screen folder as a protected design-system folder.
