# IconButton

## Description for AI

**Purpose:** Clickable icon-only action control for compact toolbar, card, row, and drag-handle actions.
**Use when:**
- edit/delete row action
- drag handle
- toolbar icon
- compact action in cards/tiles
**Variants:**
- `color`: `info` — neutral/informational icon tint; `error` — destructive action icon tint; `warning` — cautionary icon tint; `success` — positive/confirm icon tint
- `size`: `sm` — small icon scale for dense rows; `md` — default icon scale; `lg` — large icon scale for prominent actions
- `disabled`: `true` — non-interactive, visually muted state
**Required props:** `name`
**Keywords:** icon button, action icon, toolbar icon

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Clickable icon-only action control for compact toolbar, card, row, and drag-handle actions.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "icon button",
      "action icon",
      "toolbar icon"
    ],
    "whenToUse": [
      "edit/delete row action",
      "drag handle",
      "toolbar icon",
      "compact action in cards/tiles"
    ],
    "variantGuidance": [
      {
        "prop": "color",
        "values": [
          {
            "value": "info",
            "meaning": "neutral/informational icon tint"
          },
          {
            "value": "error",
            "meaning": "destructive action icon tint"
          },
          {
            "value": "warning",
            "meaning": "cautionary icon tint"
          },
          {
            "value": "success",
            "meaning": "positive/confirm icon tint"
          }
        ]
      },
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "small icon scale for dense rows"
          },
          {
            "value": "md",
            "meaning": "default icon scale"
          },
          {
            "value": "lg",
            "meaning": "large icon scale for prominent actions"
          }
        ]
      },
      {
        "prop": "disabled",
        "values": [
          {
            "value": "true",
            "meaning": "non-interactive, visually muted state"
          }
        ]
      }
    ],
    "requiredProps": [
      "name"
    ],
    "evidence": [
      {
        "source": "mined",
        "ref": "get_usage_card"
      },
      {
        "source": "source",
        "ref": "src/components/atoms/IconButton/IconButton.types.ts"
      }
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-16T18:53:42.743Z"
  }
}
```
