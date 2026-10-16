# Icon

## Description for AI

**Purpose:** Project icon primitive that renders a named icon from the generated icon map with shared size and color styling.
**Use when:**
- standalone decorative or semantic icon
- icon inside buttons, labels, badges, dialogs, lists, or status UI
- need a project-approved IconName instead of raw SVG/Lucide components
**Variants:**
- `size`: `sm` — compact inline icon; `md` — default icon size; `lg` — larger visual emphasis; `inherit` — match parent font size
- `color`: `primary` — primary theme color; `action` — action/icon control color; `disabled` — disabled state color; `secondary` — secondary theme color; `error` — error/destructive state; `info` — informational state; `success` — success/positive state; `warning` — warning/caution state; `inherit` — parent text color; `custom string` — explicit CSS color
**Required props:** `name`
**Keywords:** icon, glyph, project icon, status icon

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Project icon primitive that renders a named icon from the generated icon map with shared size and color styling.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [
      "Use a project-approved IconName from the generated icon map instead of raw SVG or Lucide components."
    ],
    "schemaVersion": 1,
    "keywords": [
      "icon",
      "glyph",
      "project icon",
      "status icon"
    ],
    "whenToUse": [
      "standalone decorative or semantic icon",
      "icon inside buttons, labels, badges, dialogs, lists, or status UI",
      "need a project-approved IconName instead of raw SVG/Lucide components"
    ],
    "variantGuidance": [
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "compact inline icon"
          },
          {
            "value": "md",
            "meaning": "default icon size"
          },
          {
            "value": "lg",
            "meaning": "larger visual emphasis"
          },
          {
            "value": "inherit",
            "meaning": "match parent font size"
          }
        ]
      },
      {
        "prop": "color",
        "values": [
          {
            "value": "primary",
            "meaning": "primary theme color"
          },
          {
            "value": "action",
            "meaning": "action/icon control color"
          },
          {
            "value": "disabled",
            "meaning": "disabled state color"
          },
          {
            "value": "secondary",
            "meaning": "secondary theme color"
          },
          {
            "value": "error",
            "meaning": "error/destructive state"
          },
          {
            "value": "info",
            "meaning": "informational state"
          },
          {
            "value": "success",
            "meaning": "success/positive state"
          },
          {
            "value": "warning",
            "meaning": "warning/caution state"
          },
          {
            "value": "inherit",
            "meaning": "parent text color"
          },
          {
            "value": "custom string",
            "meaning": "explicit CSS color"
          }
        ]
      }
    ],
    "requiredProps": [
      "name"
    ],
    "canonicalSnippets": [
      {
        "code": "<Icon name=\"Add\" size=\"md\" color=\"primary\" />",
        "label": "Default project icon"
      },
      {
        "code": "<Icon name=\"AlertTriangle\" size=\"sm\" color=\"warning\" />",
        "label": "Status icon"
      }
    ],
    "pairsWith": [
      "Grid",
      "Text",
      "Button",
      "IconButton",
      "Tooltip"
    ],
    "evidence": [
      {
        "source": "mined",
        "ref": ".sber-designer/design-index/usage-cards.jsonl"
      },
      {
        "source": "source",
        "ref": "src/components/atoms/Icon/Icon.types.ts"
      },
      {
        "source": "source",
        "ref": "src/components/atoms/Icon/Icon.stories.tsx"
      }
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-16T19:24:05.000Z"
  }
}
```
