# Grid

## Description for AI

**Purpose:** Layout container that arranges child elements into tile cards, grids, or rows inside a parent surface.
**Use when:**
- Inside Tile, modals, or other container components to show a list of elements as cards or grid items
- as an inner layout helper — not standalone
**Use instead:** Do not use alone on a page; always wrap inside Tile, modal, or another surface
**Variants:**
- `container`: `true` — defines a flex/grid wrapper
- `item`: `true` — a child cell inside a container
- `xs / sm / md / lg`: `1–12` — column width per breakpoint
- `spacing`: `0–10` — gap between grid items
**Required props:** `none strictly required; practically either container or item is expected`
**Canonical usage:**
_Basic grid_
```tsx
<Grid container>
  <Grid item xs={12} sm={6} md={4}>
    <Tile>...</Tile>
  </Grid>
  <Grid item xs={12} sm={6} md={4}>
    <Tile>...</Tile>
  </Grid>
</Grid>
```
**Keywords:** layout, grid, container

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Layout container that arranges child elements into tile cards, grids, or rows inside a parent surface.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "layout",
      "grid",
      "container"
    ],
    "whenToUse": [
      "Inside Tile, modals, or other container components to show a list of elements as cards or grid items",
      "as an inner layout helper — not standalone"
    ],
    "whenNotToUse": [
      "Do not use alone on a page; always wrap inside Tile, modal, or another surface"
    ],
    "variantGuidance": [
      {
        "prop": "container",
        "values": [
          {
            "value": "true",
            "meaning": "defines a flex/grid wrapper"
          }
        ]
      },
      {
        "prop": "item",
        "values": [
          {
            "value": "true",
            "meaning": "a child cell inside a container"
          }
        ]
      },
      {
        "prop": "xs / sm / md / lg",
        "values": [
          {
            "value": "1–12",
            "meaning": "column width per breakpoint"
          }
        ]
      },
      {
        "prop": "spacing",
        "values": [
          {
            "value": "0–10",
            "meaning": "gap between grid items"
          }
        ]
      }
    ],
    "requiredProps": [
      "none strictly required; practically either container or item is expected"
    ],
    "canonicalSnippets": [
      {
        "code": "<Grid container>\n  <Grid item xs={12} sm={6} md={4}>\n    <Tile>...</Tile>\n  </Grid>\n  <Grid item xs={12} sm={6} md={4}>\n    <Tile>...</Tile>\n  </Grid>\n</Grid>",
        "label": "Basic grid"
      }
    ],
    "pairsWith": [
      "Tile",
      "Text",
      "Icon",
      "Button",
      "IconButton",
      "Tooltip"
    ],
    "evidence": [
      {
        "source": "usage-cards",
        "ref": "298 usages mined across the project"
      }
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-25T21:48:02.286Z"
  }
}
```
