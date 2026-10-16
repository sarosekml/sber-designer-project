## Description for AI

**Purpose:** Checkbox input for boolean form values, with label, helper text, disabled/read/present display modes, and indeterminate state.
**Use when:** single boolean choice; opt-in flag; read-only boolean value in a form; partial or mixed selection indicator
**Variants:**

- `size`: `sm` - compact; `md` - default; `lg` - spacious.
- `viewType`: `edit` - interactive checkbox; `read` - display-only checkbox state; `present` - presentation-style non-editable field.
- `checked`: `false` - unchecked; `true` - checked.
- `indeterminate`: `true` - mixed or partial state.

**Required props:** No strictly required props in `InputCheckboxProps`; use `checked` and `onChange` for controlled editing, plus `label`/`name` for meaningful form usage.
**Canonical usage:**

```tsx
<InputCheckbox
  checked={checked}
  onChange={handleChange}
  label="Checkbox"
  name="checkbox"
  size="md"
  viewType="edit"
/>
```

**Keywords:** checkbox, boolean field, selection toggle

```sberDesigner
{
  "descriptionLayer": {
    "componentId": "molecules-inputs-inputcheckbox-inputcheckbox",
    "componentName": "InputCheckbox",
    "purpose": "Checkbox input for boolean form values, with label, helper text, disabled/read/present display modes, and indeterminate state.",
    "whenToUse": [
      "single boolean choice",
      "opt-in flag",
      "read-only boolean value in a form",
      "partial or mixed selection indicator"
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
            "meaning": "interactive checkbox"
          },
          {
            "value": "read",
            "meaning": "display-only checkbox state"
          },
          {
            "value": "present",
            "meaning": "presentation-style non-editable field"
          }
        ]
      },
      {
        "prop": "checked",
        "values": [
          {
            "value": "false",
            "meaning": "unchecked"
          },
          {
            "value": "true",
            "meaning": "checked"
          }
        ]
      },
      {
        "prop": "indeterminate",
        "values": [
          {
            "value": "true",
            "meaning": "mixed or partial state"
          }
        ]
      }
    ],
    "requiredProps": [],
    "agentGuidance": [
      "No strictly required props in InputCheckboxProps.",
      "Use checked and onChange for controlled editing.",
      "Use label and name for meaningful form usage."
    ],
    "canonicalUsage": "<InputCheckbox checked={checked} onChange={handleChange} label=\"Checkbox\" name=\"checkbox\" size=\"md\" viewType=\"edit\" />",
    "keywords": [
      "checkbox",
      "boolean field",
      "selection toggle"
    ],
    "status": "confirmed"
  }
}
```
