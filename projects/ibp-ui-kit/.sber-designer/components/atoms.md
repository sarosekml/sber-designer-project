# DictionaryBadge

## Description for AI

**Purpose:** Dictionary value badge that renders a code/name pair as a Chip or Marker with optional icons, tooltip, click, and delete behavior.
**Use when:**
- dictionary/status value in tables, cards, filters, entity badges, or compact metadata chips
- need consistent badge styling for code/name values
**Variants:**
- `component`: `Chip` - standard rounded dictionary chip; `Marker` - compact marker/pill with tooltip support
- `variant`: `outlined` - default badge style; `transparent` - minimal background; `filled` - deprecated, prefer outlined
- `type`: `edit` - editable/interactive sizing; `read` - read-only display
- `size`: `sm` - dense inline badge; `md` - default; `lg` - larger badge
**Required props:** `code`, `name`, `component`
**Keywords:** dictionary badge, status chip, marker

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Dictionary value badge that renders a code/name pair as a Chip or Marker with optional icons, tooltip, click, and delete behavior.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "dictionary badge",
      "status chip",
      "marker"
    ],
    "whenToUse": [
      "dictionary/status value in tables, cards, filters, entity badges, or compact metadata chips",
      "need consistent badge styling for code/name values"
    ],
    "variantGuidance": [
      {
        "prop": "component",
        "values": [
          {
            "value": "Chip",
            "meaning": "standard rounded dictionary chip"
          },
          {
            "value": "Marker",
            "meaning": "compact marker/pill with tooltip support"
          }
        ]
      },
      {
        "prop": "variant",
        "values": [
          {
            "value": "outlined",
            "meaning": "default badge style"
          },
          {
            "value": "transparent",
            "meaning": "minimal background"
          },
          {
            "value": "filled",
            "meaning": "deprecated, prefer outlined"
          }
        ]
      },
      {
        "prop": "type",
        "values": [
          {
            "value": "edit",
            "meaning": "editable/interactive sizing"
          },
          {
            "value": "read",
            "meaning": "read-only display"
          }
        ]
      },
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "dense inline badge"
          },
          {
            "value": "md",
            "meaning": "default"
          },
          {
            "value": "lg",
            "meaning": "larger badge"
          }
        ]
      }
    ],
    "requiredProps": [
      "code",
      "name",
      "component"
    ],
    "evidence": [
      {
        "source": "mined",
        "ref": "get_usage_card"
      },
      {
        "source": "source",
        "ref": "src/components/atoms/DictionaryBadge/DictionaryBadge.types.ts"
      }
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-16T19:26:42Z"
  }
}
```
