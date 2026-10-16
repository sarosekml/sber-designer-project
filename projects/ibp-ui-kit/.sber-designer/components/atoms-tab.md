# Tab

## Description for AI

**Purpose:** Single tab item — renders label with optional badge icon, used inside TabsGroup or PageTabs for horizontal or vertical tab navigation.
**Use when:**
- page-level tab switching (PageTabs)
- form tab views (FormConstructor)
- any multi-panel UI where user selects one view at a time
**Variants:**
- `orientation`: `horizontal` — top/side tabs; `vertical` — sidebar tab list
- `size`: `sm` — small height; `md` — medium height; `lg` — large height
- `iconValue`: `any` — shows a badge/counter on the tab
- `disabled`: `true` — greyed out non-interactive tab
**Required props:** `value`
**Keywords:** tab, tab navigation, tab item

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Single tab item — renders label with optional badge icon, used inside TabsGroup or PageTabs for horizontal or vertical tab navigation.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "tab",
      "tab navigation",
      "tab item"
    ],
    "whenToUse": [
      "page-level tab switching (PageTabs)",
      "form tab views (FormConstructor)",
      "any multi-panel UI where user selects one view at a time"
    ],
    "variantGuidance": [
      {
        "prop": "orientation",
        "values": [
          {
            "value": "horizontal",
            "meaning": "top/side tabs"
          },
          {
            "value": "vertical",
            "meaning": "sidebar tab list"
          }
        ]
      },
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "small height"
          },
          {
            "value": "md",
            "meaning": "medium height"
          },
          {
            "value": "lg",
            "meaning": "large height"
          }
        ]
      },
      {
        "prop": "iconValue",
        "values": [
          {
            "value": "any",
            "meaning": "shows a badge/counter on the tab"
          }
        ]
      },
      {
        "prop": "disabled",
        "values": [
          {
            "value": "true",
            "meaning": "greyed out non-interactive tab"
          }
        ]
      }
    ],
    "requiredProps": [
      "value"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T19:01:12.384Z"
  }
}
```
