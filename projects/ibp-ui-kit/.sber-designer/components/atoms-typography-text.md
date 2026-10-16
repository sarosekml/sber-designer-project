# Text

## Description for AI

**Purpose:** Default text style for the project — renders styled text from the shared typography scale.
**Use when:** For all UI text according to the group name. Use Body group (e.g. Body_M_Regular) for general UI text. Use Input group for input field labels and values.
**Variants:**
- `type`: `Body_M_Regular` — General UI body text, 16/20px; `Button_S_Regular` — Button labels, 14/20px
**Required props:** `type`
**Canonical usage:**
```tsx
<Text type="Body_M_Regular">Body text</Text>
```
**Keywords:** typography, text, body
**Do / Don't:** This is the default text primitive for the project — prefer this over raw <span>/<p> for all UI labels and body copy.

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Default text style for the project — renders styled text from the shared typography scale.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [
      "This is the default text primitive for the project — prefer this over raw <span>/<p> for all UI labels and body copy."
    ],
    "schemaVersion": 1,
    "keywords": [
      "typography",
      "text",
      "body"
    ],
    "whenToUse": [
      "For all UI text according to the group name. Use Body group (e.g. Body_M_Regular) for general UI text. Use Input group for input field labels and values."
    ],
    "variantGuidance": [
      {
        "prop": "type",
        "values": [
          {
            "value": "Body_M_Regular",
            "meaning": "General UI body text, 16/20px"
          },
          {
            "value": "Button_S_Regular",
            "meaning": "Button labels, 14/20px"
          }
        ]
      }
    ],
    "requiredProps": [
      "type"
    ],
    "canonicalSnippets": [
      {
        "code": "<Text type=\"Body_M_Regular\">Body text</Text>",
        "label": "Body text"
      },
      {
        "code": "<Text type=\"Button_S_Regular\">Button</Text>",
        "label": "Button label"
      }
    ],
    "pairsWith": [
      "atoms-buttons-button"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-15T12:10:42.150Z"
  }
}
```
