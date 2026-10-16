# Investment CRM Demo

Bundled editable demo project for Sber Designer. It is converted from
`tmp/demo-source` into a real Vite + React + TypeScript + Storybook app
with a seeded `.sber-designer/project.sdproj`.

## What is inside

- 13 full-screen Storybook screens rebuilt from the source HTML:
  AI Analysis, Analyst Dashboard, Analyst Feed, Asset Page, Assets List,
  Changes, Communications, Dashboard Custom, Dashboard Custom 2,
  Fund Detail, Funds List, Idea Page, and Search.
- Reusable component layer in `src/components`: shell/layout, cards,
  primitives, tables, meta lists, templates, patterns, and lightweight
  SVG/CSS chart primitives.
- Local fixtures in `src/data/demo.ts`.
- Storybook stories for reusable components and full screens.
- `parameters.docs.description` metadata and
  `parameters.sberDesigner.descriptionLayer` for future catalog-aware
  Assistant guidance.
- `.sber-designer/project.sdproj` with all 13 screens pinned and a
  seeded main journey plus custom-dashboard branch.
- `.sber-designer/templates/*.md` as project-local screen composition
  rules.
- `references/source-html/` with the HTML/CSS source snapshot used for
  conversion.

## Design mode readiness

The project includes local Vite/Storybook instrumentation for sber-designer
Design mode:

- `tools/sd-loc-vite-plugin.ts` adds `data-sd-loc="src/...:line:col"`
  to JSX while the demo app or Storybook is served.
- `vite.config.ts` enables the instrumentation for the Vite app.
- `.storybook/main.ts` enables the same instrumentation for Storybook
  screens opened inside sber-designer.
- The SeverProm deal screen
  `src/screens/investment-crm/CreditDealPageScreen.tsx` keeps editable UI in
  the screen implementation file and exposes stable `data-sd-flow-id`
  attributes for its primary actions.

This lets the Design panel resolve selected DOM elements back to React source
instead of showing only the baseline `dom-fallback` state.

## Commands

```bash
bun run dev
bun run storybook
bun run typecheck
bun run build
bun run build-storybook
```

Last verified locally on 2026-05-10 with:

```bash
bun run --cwd projects/demo-project typecheck
bun run --cwd projects/demo-project build
bun run --cwd projects/demo-project build-storybook
```

## How it opens today

Projects Home injects this project as a bundled demo card when
`projects/demo-project` exists. Opening the card currently edits this
checked-in template directly. Copy-on-open into a disposable user
workspace is still backlog 0005 work.

## Refreshing from `tmp/demo-source`

1. Copy updated source HTML/CSS into `references/source-html/`.
2. Port repeated UI into `src/components` first, then compose full
   screens in `src/pages`.
3. Export or update the screen stories in `src/stories/Screens.stories.tsx`.
4. Keep `src/storybook/descriptions.ts` and story parameters in sync so
   component usage guidance remains available.
5. Update `.sber-designer/project.sdproj` when screen ids, names, or
   flows change.
6. Run `typecheck`, `build`, and `build-storybook`.

The demo uses hand-built chart primitives rather than a chart framework:
the analytics are static demo visuals, so adding a runtime chart
dependency would not buy enough value yet.
