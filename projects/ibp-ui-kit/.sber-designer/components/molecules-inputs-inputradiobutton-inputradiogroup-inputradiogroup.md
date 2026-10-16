# InputRadioGroup

## Description for AI

**Purpose:** Radio button group for selecting a single value from a list of options, with vertical/horizontal layout and read/edit/present display modes.
**Use when:**
- single-choice selection from 2–6 options
- form fields with mutually exclusive values
- read-only display of a selected option
**Variants:**
- `orientation`: `vertical` — stack options vertically (default); `horizontal` — inline row
- `size`: `sm` — compact density; `md` — medium density; `lg` — larger spacing
- `viewType`: `edit` — interactive (default); `read` — disabled display; `present` — plain text display
**Required props:** `list`
**Keywords:** radio group, single select, option list

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Radio button group for selecting a single value from a list of options, with vertical/horizontal layout and read/edit/present display modes.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "radio group",
      "single select",
      "option list"
    ],
    "whenToUse": [
      "single-choice selection from 2–6 options",
      "form fields with mutually exclusive values",
      "read-only display of a selected option"
    ],
    "variantGuidance": [
      {
        "prop": "orientation",
        "values": [
          {
            "value": "vertical",
            "meaning": "stack options vertically (default)"
          },
          {
            "value": "horizontal",
            "meaning": "inline row"
          }
        ]
      },
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "compact density"
          },
          {
            "value": "md",
            "meaning": "medium density"
          },
          {
            "value": "lg",
            "meaning": "larger spacing"
          }
        ]
      },
      {
        "prop": "viewType",
        "values": [
          {
            "value": "edit",
            "meaning": "interactive (default)"
          },
          {
            "value": "read",
            "meaning": "disabled display"
          },
          {
            "value": "present",
            "meaning": "plain text display"
          }
        ]
      }
    ],
    "requiredProps": [
      "list"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T19:08:54.073Z"
  }
}
```
