# sample-storybook — sber-designer test fixture

Minimal React 19 + Storybook 8 (Vite builder) project, used to exercise
`services/sandbox` end-to-end without depending on internal corporate
registries (the way `ibp-ui-kit` does).

This package is **deliberately outside** the root Bun workspace
(see root `package.json` `workspaces` field) — it has its own deps and
boots in isolation.

## Run on its own

```bash
cd examples/sample-storybook
bun install
bun run storybook       # serves on :6006
```

Open `http://localhost:6006` and you should see two stories: Button
and MetricCard.

## Run through sber-designer

```bash
# From the repo root:
bun run dev
```

Open `http://localhost:5173` → **Connect repo** → paste the absolute
path of `examples/sample-storybook` → open the project → add/pin a
story in the Screens panel → Design mode → click an element. The
overlay reads source location through React Fiber's `__source` (no Babel
plugin required — see ADR-0007).
