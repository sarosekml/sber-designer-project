# Catalog Response Shape

Use this sber-designer knowledge when choosing project components, index
records, or source files for generation and editing.

## list_components

`list_components` returns Storybook or static catalog entries.

```jsonc
{
  "components": [
    {
      "id": "components-data-table",
      "title": "Components/DataTable",
      "shortName": "DataTable",
      "filePath": "src/components/DataTable.tsx",
      "description": "Dense data table for operational queues.",
      "stories": [
        {
          "id": "components-data-table--default",
          "name": "Default",
          "previewUrl": "http://localhost:6006/iframe.html?id=...",
        },
      ],
    },
  ],
}
```

Use `id` and `filePath` for follow-up reads. Use `stories[].id` when
registering a screen through `screen_create`.

## Project Index Search

`search_project_index` returns compact search hits.

```jsonc
{
  "query": "approval queue",
  "results": [
    {
      "type": "component",
      "id": "components-data-table",
      "title": "Components/DataTable",
      "filePath": "src/components/DataTable.tsx",
      "summary": "Dense data table for approvals",
    },
  ],
}
```

Use exact getters after search:

- `get_indexed_component` for component record plus notes.
- `get_indexed_token` for token value/source.
- `get_indexed_icon` for project icon or Lucide fallback metadata.
- `list_indexed_screens` for implementation/story ownership and
  Design-readable status.

## read_file

`read_file` returns a workspace-relative path and contents.

```jsonc
{
  "path": "src/components/DataTable.tsx",
  "contents": "export function DataTable(...) { ... }",
}
```

Read only the files needed for the current decision:

- component source before using unfamiliar props;
- screen implementation before patching a selected target;
- nearby stories to copy realistic usage;
- Storybook template stories when the project uses Storybook as its
  project-specific template source.

Do not use broad source scans before checking catalog and project-index tools.
