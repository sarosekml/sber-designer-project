# Table

## Description for AI

**Purpose:** Data table for dense, sortable, resizable, pageable row display with optional row details, column visibility, and sticky headers.
**Use when:**
- payment registries
- risk-segment lists
- any screen with many rows needing sorting, paging, or column resizing
**Use instead:**
- checkbox table when rows need selection only
- simple list when no columns needed
**Variants:**
- `isBordered`: `true` — bordered rows; `false` — borderless rows
- `stickyHeader`: `true` — fixed header on scroll; `false` — header scrolls with content
- `columnsResizing`: `true` — draggable column widths; `false` — fixed column widths
- `virtualized`: `true` — large dataset performance (virtual rows); `false` — standard render
**Required props:** `columns`, `rows`
**Keywords:** data table, rows, columns, pagination, sorting

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Data table for dense, sortable, resizable, pageable row display with optional row details, column visibility, and sticky headers.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "data table",
      "rows",
      "columns",
      "pagination",
      "sorting"
    ],
    "whenToUse": [
      "payment registries",
      "risk-segment lists",
      "any screen with many rows needing sorting, paging, or column resizing"
    ],
    "whenNotToUse": [
      "checkbox table when rows need selection only",
      "simple list when no columns needed"
    ],
    "variantGuidance": [
      {
        "prop": "isBordered",
        "values": [
          {
            "value": "true",
            "meaning": "bordered rows"
          },
          {
            "value": "false",
            "meaning": "borderless rows"
          }
        ]
      },
      {
        "prop": "stickyHeader",
        "values": [
          {
            "value": "true",
            "meaning": "fixed header on scroll"
          },
          {
            "value": "false",
            "meaning": "header scrolls with content"
          }
        ]
      },
      {
        "prop": "columnsResizing",
        "values": [
          {
            "value": "true",
            "meaning": "draggable column widths"
          },
          {
            "value": "false",
            "meaning": "fixed column widths"
          }
        ]
      },
      {
        "prop": "virtualized",
        "values": [
          {
            "value": "true",
            "meaning": "large dataset performance (virtual rows)"
          },
          {
            "value": "false",
            "meaning": "standard render"
          }
        ]
      }
    ],
    "requiredProps": [
      "columns",
      "rows"
    ],
    "pairsWith": [
      "atoms-gridtiles-grid",
      "atoms-buttons-button",
      "atoms-typography-text",
      "atoms-divider",
      "atoms-iconbutton"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T19:00:21.846Z"
  }
}
```
