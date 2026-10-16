# Project Index Anatomy

The sber-designer project index lives in `.sber-designer/design-index`. It is
the runtime source for project-specific design, component, token, icon, route,
screen, and agent-note context.

Read `project-index-format` for the artifact contract. Use this file for how
`ai-product-designer` should consume the index.

## High-Signal Files

`manifest.json` gives freshness, source flags, counts, and artifact paths.

```jsonc
{
  "version": 2,
  "projectName": "Payments",
  "sources": { "storybookCatalog": true, "staticScan": true },
  "counts": { "components": 42, "tokens": 81, "screens": 7 },
}
```

`prompt-summary.md` is compact first-pass context. Read it through
`get_project_index_status` before opening broad source files.

```md
Project uses React, Tailwind, an indexed component library, compact table-heavy layouts.
```

`components.jsonl` contains one component per line.

```jsonc
{
  "id": "components-data-table",
  "title": "Components/DataTable",
  "shortName": "DataTable",
  "filePath": "src/components/DataTable.tsx",
  "tags": ["table", "data"],
  "groupIds": ["tables"],
  "confidence": "high",
}
```

`component-groups.json` maps components to product jobs.

```jsonc
{
  "groups": [
    {
      "id": "tables",
      "name": "Tables and queues",
      "componentIds": ["components-data-table"],
    },
  ],
}
```

`tokens.json` contains token records from `DESIGN.md`, CSS, Tailwind, theme
files, or design brief.

```jsonc
{
  "tokens": [
    {
      "id": "color-surface-default",
      "name": "color.surface.default",
      "value": "var(--surface-default)",
      "kind": "color",
    },
  ],
}
```

`icons.json` lists project icons first and Lucide fallback metadata second.

```jsonc
{
  "projectIcons": [{ "id": "status-warning", "importName": "StatusWarningIcon" }],
  "fallback": { "provider": "lucide", "packageName": "lucide-react" },
}
```

`assets.jsonl` lists project-local icons, illustrations, and image assets.
Imported asset packs write provenance to `.sber-designer/assets/imported-packs.json`;
the index exposes only project-safe paths and import guidance.

```jsonc
{
  "id": "asset-illustration-empty-payments",
  "kind": "illustration",
  "name": "Empty payments",
  "filePath": "src/assets/illustrations/empty-payments.png",
  "usageMode": "asset-url",
  "importName": "emptyPaymentsUrl",
  "importSource": "@/assets",
  "storybookTitle": "Assets/Illustrations",
  "tags": ["empty", "payments", "illustrations"],
}
```

`screens.jsonl` records source ownership and Design-readable status.

```jsonc
{
  "id": "screens-approvals",
  "name": "Approvals",
  "implementationPath": "src/screens/Approvals.tsx",
  "storyPath": "src/screens/Approvals.stories.tsx",
  "designReadableStatus": "candidate",
}
```

`agent-notes.jsonl` stores project-specific enrichment and migrated legacy
guidance.

```jsonc
{
  "id": "note-data-table-usage",
  "targetType": "component",
  "targetId": "components-data-table",
  "intent": "prefer",
  "source": "agent",
  "note": "Use for approval queues with status filters.",
}
```

`diagnostics.json` explains missing, stale, ambiguous, or unsupported context.

```jsonc
{
  "diagnostics": [
    {
      "level": "warning",
      "filePath": ".sber-designer/design-index/tokens.json",
      "message": "No spacing tokens detected.",
    },
  ],
}
```

## Tool Consumption

- `get_project_index_status`: freshness, counts, diagnostics, prompt summary.
- `search_project_index`: fast lookup across components, tokens, icons,
  assets, screens, routes, and notes.
- `get_indexed_component`: exact component plus matching notes.
- `get_indexed_token`: exact token by id or name.
- `get_indexed_asset`: exact imported/stored icon, illustration, or image by
  id, name, path, importName, Storybook title, or tag.
- `get_indexed_icon`: indexed project asset icon first, legacy project icon
  second, Lucide fallback third.
- `list_indexed_screens`: screen ownership and Design-readable status.
- `request_project_reindex`: ask the user before regenerating stale context.

Do not read every index file by hand unless tool summaries are missing the fact
you need.
