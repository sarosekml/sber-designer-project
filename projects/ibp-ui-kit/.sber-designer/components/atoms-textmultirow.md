# TextMultiRow

## Description for AI

**Purpose:** Multi-line text display for table cells with automatic line clamping and optional tooltip for truncated content.
**Use when:**
- displaying text that may overflow in table cells
- presenting multi-line string values in read mode
**Use instead:** editable text — use InputText multiline instead
**Variants:**
- `noTooltip`: `true` — suppress truncation tooltip; `false (default)` — show tooltip on truncated content
- `lineClamp`: `auto` — automatic line clamping; `number` — clamp to exact number of lines
**Required props:** `children`
**Canonical usage:**
_table cell — no tooltip_
```tsx
<TextMultiRow noTooltip dataTestId={'cell-name'}>
  {row.fullName}
</TextMultiRow>
```
_table cell with tooltip_
```tsx
<TextMultiRow dataTestId={dataTestId}>{str}</TextMultiRow>
```
**Keywords:** multi-line text, table cell text, text truncation

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Multi-line text display for table cells with automatic line clamping and optional tooltip for truncated content.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "multi-line text",
      "table cell text",
      "text truncation"
    ],
    "whenToUse": [
      "displaying text that may overflow in table cells",
      "presenting multi-line string values in read mode"
    ],
    "whenNotToUse": [
      "editable text — use InputText multiline instead"
    ],
    "variantGuidance": [
      {
        "prop": "noTooltip",
        "values": [
          {
            "value": "true",
            "meaning": "suppress truncation tooltip"
          },
          {
            "value": "false (default)",
            "meaning": "show tooltip on truncated content"
          }
        ]
      },
      {
        "prop": "lineClamp",
        "values": [
          {
            "value": "auto",
            "meaning": "automatic line clamping"
          },
          {
            "value": "number",
            "meaning": "clamp to exact number of lines"
          }
        ]
      }
    ],
    "requiredProps": [
      "children"
    ],
    "canonicalSnippets": [
      {
        "code": "<TextMultiRow noTooltip dataTestId={'cell-name'}>\n  {row.fullName}\n</TextMultiRow>",
        "label": "table cell — no tooltip"
      },
      {
        "code": "<TextMultiRow dataTestId={dataTestId}>{str}</TextMultiRow>",
        "label": "table cell with tooltip"
      }
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T19:07:53.501Z"
  }
}
```
