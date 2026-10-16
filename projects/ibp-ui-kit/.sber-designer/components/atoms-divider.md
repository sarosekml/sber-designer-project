# Divider

## Description for AI

**Purpose:** Visual separator line between sections or items — supports horizontal and vertical orientation with theme-aligned color variants.
**Use when:**
- separating content sections in a layout
- between items in a list or toolbar
- inside Paper/card to split header from body
**Variants:**
- `orientation`: `horizontal` — full-width line between content rows; `vertical` — inline separator between inline elements
- `color`: `primary` — standard theme divider; `light` — subtle/low-contrast; `dark` — high-contrast emphasis
**Required props:** `orientation`, `flexItem`
**Canonical usage:**
_Section separator_
```tsx
<Divider orientation="horizontal" />
```
_Inline item separator_
```tsx
<Divider orientation="vertical" flexItem />
```
**Keywords:** separator, divider, splitter

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Visual separator line between sections or items — supports horizontal and vertical orientation with theme-aligned color variants.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "separator",
      "divider",
      "splitter"
    ],
    "whenToUse": [
      "separating content sections in a layout",
      "between items in a list or toolbar",
      "inside Paper/card to split header from body"
    ],
    "variantGuidance": [
      {
        "prop": "orientation",
        "values": [
          {
            "value": "horizontal",
            "meaning": "full-width line between content rows"
          },
          {
            "value": "vertical",
            "meaning": "inline separator between inline elements"
          }
        ]
      },
      {
        "prop": "color",
        "values": [
          {
            "value": "primary",
            "meaning": "standard theme divider"
          },
          {
            "value": "light",
            "meaning": "subtle/low-contrast"
          },
          {
            "value": "dark",
            "meaning": "high-contrast emphasis"
          }
        ]
      }
    ],
    "requiredProps": [
      "orientation",
      "flexItem"
    ],
    "canonicalSnippets": [
      {
        "code": "<Divider orientation=\"horizontal\" />",
        "label": "Section separator"
      },
      {
        "code": "<Divider orientation=\"vertical\" flexItem />",
        "label": "Inline item separator"
      }
    ],
    "pairsWith": [
      "atoms-iconbutton",
      "atoms-link-link",
      "atoms-gridtiles-grid",
      "atoms-paper",
      "atoms-typography-text"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T18:55:28.036Z"
  }
}
```
