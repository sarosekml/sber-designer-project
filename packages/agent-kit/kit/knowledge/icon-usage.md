# Icon Usage

Use this sber-designer knowledge whenever a screen, component, action, empty
state, or status needs an icon.

## Resolution Order

1. Call `search_project_index` with `types: ["icon"]` for the domain intent.
2. Call `get_indexed_icon` for the exact id/name/importName you want.
3. Prefer `source: "project-asset"` results from
   `.sber-designer/design-index/assets.jsonl` when present.
4. Then prefer `source: "project"` results from
   `.sber-designer/design-index/icons.json`.
5. Use Lucide fallback only when the index reports no project icon source for
   the intent.

For illustrations and image assets, search with `types: ["asset"]` and call
`get_indexed_asset`. Do not use external local source folders in production
screen code.

## icons.json Shape

```jsonc
{
  "projectIcons": [
    {
      "id": "status-warning",
      "name": "Status warning",
      "importName": "StatusWarningIcon",
      "filePath": "src/icons/status-warning.tsx",
    },
  ],
  "fallback": {
    "provider": "lucide",
    "packageName": "lucide-react",
    "icons": [{ "id": "search", "name": "Search", "importName": "Search" }],
  },
}
```

## assets.jsonl Icon Shape

```jsonc
{
  "id": "asset-icon-payment-warning",
  "kind": "icon",
  "name": "Payment warning",
  "filePath": "src/assets/icons/payment-warning.svg",
  "usageMode": "asset-url",
  "importName": "paymentWarningUrl",
  "importSource": "@/assets",
  "storybookTitle": "Assets/Icons",
}
```

## Rules

- Do not invent icon imports or filenames.
- Prefer indexed project asset icons before Lucide fallback.
- Use icons inside buttons and menu items where the project already does so.
- Icon-only buttons need accessible labels.
- For statuses, match project status icons before using generic warning/check
  symbols.
- If an icon lookup is ambiguous, inspect existing component source instead of
  guessing.
