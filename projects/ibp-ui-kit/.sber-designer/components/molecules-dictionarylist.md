# DictionaryList

## Description for AI

**Purpose:** Renders a list of dictionary items (code+name pairs) as DictionaryBadge chips/markers, with optional collapse/expand when items exceed a limit.
**Use when:**
- displaying multiple dictionary values in table cells, detail panels, or filter rows
- when you need collapsible chip/marker list with click/delete callbacks
**Variants:**
- `itemSize`: `sm` — small badge size; `md` — medium badge size (default); `lg` — large badge size
- `itemType`: `edit` — editable mode with delete controls; `read` — read-only display; `present` — presentation/display mode
- `itemVariant`: `outlined` — outlined border style; `filled` — filled/solid background
- `itemComponent`: `Chip` — renders as Chip badges; `Marker` — renders as Marker indicators
**Required props:** `data`
**Keywords:** dictionary list, chip list, badge list

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Renders a list of dictionary items (code+name pairs) as DictionaryBadge chips/markers, with optional collapse/expand when items exceed a limit.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "dictionary list",
      "chip list",
      "badge list"
    ],
    "whenToUse": [
      "displaying multiple dictionary values in table cells, detail panels, or filter rows",
      "when you need collapsible chip/marker list with click/delete callbacks"
    ],
    "variantGuidance": [
      {
        "prop": "itemSize",
        "values": [
          {
            "value": "sm",
            "meaning": "small badge size"
          },
          {
            "value": "md",
            "meaning": "medium badge size (default)"
          },
          {
            "value": "lg",
            "meaning": "large badge size"
          }
        ]
      },
      {
        "prop": "itemType",
        "values": [
          {
            "value": "edit",
            "meaning": "editable mode with delete controls"
          },
          {
            "value": "read",
            "meaning": "read-only display"
          },
          {
            "value": "present",
            "meaning": "presentation/display mode"
          }
        ]
      },
      {
        "prop": "itemVariant",
        "values": [
          {
            "value": "outlined",
            "meaning": "outlined border style"
          },
          {
            "value": "filled",
            "meaning": "filled/solid background"
          }
        ]
      },
      {
        "prop": "itemComponent",
        "values": [
          {
            "value": "Chip",
            "meaning": "renders as Chip badges"
          },
          {
            "value": "Marker",
            "meaning": "renders as Marker indicators"
          }
        ]
      }
    ],
    "requiredProps": [
      "data"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T19:11:43.679Z"
  }
}
```
