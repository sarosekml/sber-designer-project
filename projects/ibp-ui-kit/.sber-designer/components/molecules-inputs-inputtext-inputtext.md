## Description for AI

**Purpose:** Text input field for entering or displaying string values, including multiline text, labels, helper text, prefixes/postfixes, and validation states.
**Use when:** single-line text field; multiline text area; read-only text value in a form; labeled input with helper or validation message
**Variants:**

- `size`: `sm` - compact; `md` - default; `lg` - spacious.
- `viewType`: `edit` - interactive input; `read` - display-only value; `present` - presentation-style non-editable field.
- `multiline`: `false` - single-line input; `true` - textarea.

**Required props:** None strictly required in `InputTextProps`; use `value` and `onChange` for controlled editing, plus `label` and `name` for meaningful form usage.
**Canonical usage:**

```tsx
<InputText
  label="Name"
  name="name"
  value={value}
  onChange={setValue}
  viewType="edit"
  size="md"
/>
```

**Keywords:** text input, form field, textarea

```sberDesigner
{
  "descriptionLayer": {
    "componentId": "molecules-inputs-inputtext-inputtext",
    "componentName": "InputText",
    "purpose": "Text input field for entering or displaying string values, including multiline text, labels, helper text, prefixes/postfixes, and validation states.",
    "whenToUse": [
      "single-line text field",
      "multiline text area",
      "read-only text value in a form",
      "labeled input with helper or validation message"
    ],
    "whenNotToUse": [],
    "variantGuidance": [
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "compact"
          },
          {
            "value": "md",
            "meaning": "default"
          },
          {
            "value": "lg",
            "meaning": "spacious"
          }
        ]
      },
      {
        "prop": "viewType",
        "values": [
          {
            "value": "edit",
            "meaning": "interactive input"
          },
          {
            "value": "read",
            "meaning": "display-only value"
          },
          {
            "value": "present",
            "meaning": "presentation-style non-editable field"
          }
        ]
      },
      {
        "prop": "multiline",
        "values": [
          {
            "value": "false",
            "meaning": "single-line input"
          },
          {
            "value": "true",
            "meaning": "textarea"
          }
        ]
      }
    ],
    "requiredProps": [],
    "canonicalUsage": "<InputText label=\"Name\" name=\"name\" value={value} onChange={setValue} viewType=\"edit\" size=\"md\" />",
    "agentGuidance": [
      "No props are strictly required by InputTextProps.",
      "Use value and onChange for controlled editing.",
      "Use label and name for meaningful form usage."
    ],
    "keywords": [
      "text input",
      "form field",
      "textarea"
    ],
    "status": "confirmed"
  }
}
```
