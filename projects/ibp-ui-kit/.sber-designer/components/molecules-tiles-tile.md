# Tile

## Description for AI

**Purpose:** Card container for dashboard/section content — wraps children with an optional header (title, subtitle, postfixes, actions), size variants, highlight, and spot marker.
**Use when:**
- organising dashboard form sections
- grouping related inputs/errors into a titled card
- any layout block that needs a header with actions
**Variants:**
- `size`: `sm` — compact card; `md` — medium card; `lg` — large (default)
- `variant`: `elevation` — raised shadow; `outlined` — border-only (not for lg)
- `headless`: `true` — no header, pure content
- `hasSpot`: `true` — coloured left accent bar
- `isHighlighted`: `true` — highlighted border and background
**Required props:** `children`
**Keywords:** card, dashboard tile, section container

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Card container for dashboard/section content — wraps children with an optional header (title, subtitle, postfixes, actions), size variants, highlight, and spot marker.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "card",
      "dashboard tile",
      "section container"
    ],
    "whenToUse": [
      "organising dashboard form sections",
      "grouping related inputs/errors into a titled card",
      "any layout block that needs a header with actions"
    ],
    "variantGuidance": [
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "compact card"
          },
          {
            "value": "md",
            "meaning": "medium card"
          },
          {
            "value": "lg",
            "meaning": "large (default)"
          }
        ]
      },
      {
        "prop": "variant",
        "values": [
          {
            "value": "elevation",
            "meaning": "raised shadow"
          },
          {
            "value": "outlined",
            "meaning": "border-only (not for lg)"
          }
        ]
      },
      {
        "prop": "headless",
        "values": [
          {
            "value": "true",
            "meaning": "no header, pure content"
          }
        ]
      },
      {
        "prop": "hasSpot",
        "values": [
          {
            "value": "true",
            "meaning": "coloured left accent bar"
          }
        ]
      },
      {
        "prop": "isHighlighted",
        "values": [
          {
            "value": "true",
            "meaning": "highlighted border and background"
          }
        ]
      }
    ],
    "requiredProps": [
      "children"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-25T21:49:53.111Z"
  }
}
```
