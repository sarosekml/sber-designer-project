# Button

## Description for AI

**Purpose:** Primary trigger for commands, form submission, and navigation actions.
**Use when:**
- Any clickable action like Save, Cancel, Submit, or page navigation
- Icon+label actions where startIcon/endIcon are passed
- Standalone icon-only actions (children omitted, just startIcon)
- Form submission or inline validation triggers
**Use instead:**
- Simple text links — use Link instead
- Navigation sidebar items — use NavItem instead
**Variants:**
- `type`: `accent` — Primary call-to-action — highest visual emphasis; `outlined` — Secondary action — bordered, less emphasis; `transparent` — Tertiary / text-only action — minimal emphasis, no border
- `size`: `l` — Large — for spacious layouts; `m` — Medium — default size; `s` — Small — compact spaces; `xs` — Extra small — dense toolbars and inline actions
- `color`: `primary` — Brand color (default); `secondary` — Grey-toned; `info` — Info-blue; `success` — Green affirmative; `warning` — Orange caution; `error` — Red destructive
- `disabled`: `true` — Button is non-interactive and dimmed; `false` — Button is interactive
- `hasLoader`: `true` — Shows a spinner and disables click — use for async actions; `false` — No spinner
- `fullWidth`: `true` — Stretches to 100% container width; `false` — Shrinks to content width
**Required props:** `children`, `onClick`
**Canonical usage:**
_Simple save_
```tsx
<Button onClick={handleSave}>Save</Button>
```
_Outlined with icon_
```tsx
<Button type="outlined" startIcon={<Icon iconName="Edit" />}>Edit</Button>
```
_Loading state_
```tsx
<Button hasLoader disabled={isLoading} onClick={handleSubmit}>Submit</Button>
```
_Destructive tertiary_
```tsx
<Button type="transparent" color="error" onClick={handleDelete}>Delete</Button>
```
_Icon-only_
```tsx
<Button startIcon={<Icon iconName="Search" />} />
```
**Keywords:** button, action button, submit, secondary button, icon+button, tertiary button
**Do / Don't:**
- Use type='accent' for primary actions (one per view), type='outlined' for secondary, type='transparent' for tertiary
- startIcon/endIcon accept <Icon iconName="..." /> — never Lucide raw components
- When children is omitted, the button renders as an icon-only square — always provide aria-label

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Primary trigger for commands, form submission, and navigation actions.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [
      "Use type='accent' for primary actions (one per view), type='outlined' for secondary, type='transparent' for tertiary",
      "startIcon/endIcon accept <Icon iconName=\"...\" /> — never Lucide raw components",
      "When children is omitted, the button renders as an icon-only square — always provide aria-label"
    ],
    "schemaVersion": 1,
    "keywords": [
      "button",
      "action button",
      "submit",
      "secondary button",
      "icon+button",
      "tertiary button"
    ],
    "whenToUse": [
      "Any clickable action like Save, Cancel, Submit, or page navigation",
      "Icon+label actions where startIcon/endIcon are passed",
      "Standalone icon-only actions (children omitted, just startIcon)",
      "Form submission or inline validation triggers"
    ],
    "whenNotToUse": [
      "Simple text links — use Link instead",
      "Navigation sidebar items — use NavItem instead"
    ],
    "variantGuidance": [
      {
        "prop": "type",
        "values": [
          {
            "value": "accent",
            "meaning": "Primary call-to-action — highest visual emphasis"
          },
          {
            "value": "outlined",
            "meaning": "Secondary action — bordered, less emphasis"
          },
          {
            "value": "transparent",
            "meaning": "Tertiary / text-only action — minimal emphasis, no border"
          }
        ]
      },
      {
        "prop": "size",
        "values": [
          {
            "value": "l",
            "meaning": "Large — for spacious layouts"
          },
          {
            "value": "m",
            "meaning": "Medium — default size"
          },
          {
            "value": "s",
            "meaning": "Small — compact spaces"
          },
          {
            "value": "xs",
            "meaning": "Extra small — dense toolbars and inline actions"
          }
        ]
      },
      {
        "prop": "color",
        "values": [
          {
            "value": "primary",
            "meaning": "Brand color (default)"
          },
          {
            "value": "secondary",
            "meaning": "Grey-toned"
          },
          {
            "value": "info",
            "meaning": "Info-blue"
          },
          {
            "value": "success",
            "meaning": "Green affirmative"
          },
          {
            "value": "warning",
            "meaning": "Orange caution"
          },
          {
            "value": "error",
            "meaning": "Red destructive"
          }
        ]
      },
      {
        "prop": "disabled",
        "values": [
          {
            "value": "true",
            "meaning": "Button is non-interactive and dimmed"
          },
          {
            "value": "false",
            "meaning": "Button is interactive"
          }
        ]
      },
      {
        "prop": "hasLoader",
        "values": [
          {
            "value": "true",
            "meaning": "Shows a spinner and disables click — use for async actions"
          },
          {
            "value": "false",
            "meaning": "No spinner"
          }
        ]
      },
      {
        "prop": "fullWidth",
        "values": [
          {
            "value": "true",
            "meaning": "Stretches to 100% container width"
          },
          {
            "value": "false",
            "meaning": "Shrinks to content width"
          }
        ]
      }
    ],
    "requiredProps": [
      "children",
      "onClick"
    ],
    "canonicalSnippets": [
      {
        "code": "<Button onClick={handleSave}>Save</Button>",
        "label": "Simple save"
      },
      {
        "code": "<Button type=\"outlined\" startIcon={<Icon iconName=\"Edit\" />}>Edit</Button>",
        "label": "Outlined with icon"
      },
      {
        "code": "<Button hasLoader disabled={isLoading} onClick={handleSubmit}>Submit</Button>",
        "label": "Loading state"
      },
      {
        "code": "<Button type=\"transparent\" color=\"error\" onClick={handleDelete}>Delete</Button>",
        "label": "Destructive tertiary"
      },
      {
        "code": "<Button startIcon={<Icon iconName=\"Search\" />} />",
        "label": "Icon-only"
      }
    ],
    "pairsWith": [
      "Icon",
      "ButtonGroup"
    ],
    "a11yNotes": [
      "Icon-only Button must have aria-label set",
      "Disabled state meets 3:1 contrast minimum"
    ],
    "interactionNotes": [
      "hasLoader replaces children with a spinner — children stay in DOM for width stability",
      "onClick is called with SyntheticEvent — use e.preventDefault() inside forms",
      "fullWidth does not affect hasLoader width behaviour"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-15T20:04:06.846Z"
  }
}
```
