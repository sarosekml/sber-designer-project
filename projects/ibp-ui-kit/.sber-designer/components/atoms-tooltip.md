## Description for AI

**Purpose:** Wrapper that shows contextual text, hint, error, warning, or full truncated content for a child element on hover, focus, or touch.
**Use when:** overflow text reveal; icon/control explanation; input validation tooltip; contextual hint
**Variants:**

- `type`: `default` - neutral tooltip; `hint` - help hint; `error` - validation or error message; `warning` - warning message.
- `arrow`: `center` - default centered arrow; `none` - no arrow; `left` - arrow shifted left; `right` - arrow shifted right; `top` - arrow shifted toward top; `bottom` - arrow shifted toward bottom.
- `placement`: `bottom` - popup below the child; `left` - popup to the left; `right` - popup to the right; `top` - popup above the child.

**Required props:** `children`, `title` for meaningful display. Custom props are optional with defaults: `type="default"`, `arrow="center"`, `placement="bottom"`.
**Canonical usage:**

```tsx
<Tooltip title={text}>
  <Text
    type="BodyXSReg"
    sx={{
      maxWidth: 260,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'block',
    }}
  >
    {text}
  </Text>
</Tooltip>
```

**Keywords:** tooltip, hint, hover help

```sberDesigner
{
  "descriptionLayer": {
    "componentId": "atoms-tooltip",
    "componentName": "Tooltip",
    "purpose": "Wrapper that shows contextual text, hint, error, warning, or full truncated content for a child element on hover, focus, or touch.",
    "whenToUse": [
      "overflow text reveal",
      "icon/control explanation",
      "input validation tooltip",
      "contextual hint"
    ],
    "whenNotToUse": [],
    "variantGuidance": [
      {
        "prop": "type",
        "values": [
          {
            "value": "default",
            "meaning": "neutral tooltip"
          },
          {
            "value": "hint",
            "meaning": "help hint"
          },
          {
            "value": "error",
            "meaning": "validation or error message"
          },
          {
            "value": "warning",
            "meaning": "warning message"
          }
        ]
      },
      {
        "prop": "arrow",
        "values": [
          {
            "value": "center",
            "meaning": "default centered arrow"
          },
          {
            "value": "none",
            "meaning": "no arrow"
          },
          {
            "value": "left",
            "meaning": "arrow shifted left"
          },
          {
            "value": "right",
            "meaning": "arrow shifted right"
          },
          {
            "value": "top",
            "meaning": "arrow shifted toward top"
          },
          {
            "value": "bottom",
            "meaning": "arrow shifted toward bottom"
          }
        ]
      },
      {
        "prop": "placement",
        "values": [
          {
            "value": "bottom",
            "meaning": "popup below the child"
          },
          {
            "value": "left",
            "meaning": "popup to the left"
          },
          {
            "value": "right",
            "meaning": "popup to the right"
          },
          {
            "value": "top",
            "meaning": "popup above the child"
          }
        ]
      }
    ],
    "requiredProps": [
      "children",
      "title"
    ],
    "canonicalUsage": "<Tooltip title={text}><Text type=\"BodyXSReg\" sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{text}</Text></Tooltip>",
    "keywords": [
      "tooltip",
      "hint",
      "hover help"
    ],
    "status": "confirmed"
  }
}
```
