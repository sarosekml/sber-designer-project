## Description for AI

**Purpose:** Autocomplete input for selecting one or multiple options from local or async dictionaries, with edit and read display modes.
**Use when:** dictionary lookup field; searchable select; multi-select tags; async option loading; read-only display of selected values
**Variants:**

- `multiple`: `false` - single value; `true` - multi-select.
- `viewType`: `edit` - interactive field; `read` - display-only value.
- `viewFormat`: `text` - plain single/read value; `chip` - selected values as chips; `marker` - compact read markers; `outerChip` - selected chips rendered below the input.
- `size`: `sm` - dense; `md` - default; `lg` - spacious.

**Required props:** `value`, `getOptionLabel`, component-specific option identity via `getOptionIdentifier` or `isOptionEqualToValue` when values are objects.
**Canonical usage:**

```tsx
<InputAutocomplete
  value={value}
  options={options}
  getOptionLabel={getOptionLabel}
  getOptionIdentifier={getOptionIdentifier}
  multiple={false}
  viewType="edit"
  size="md"
/>
```

**Keywords:** autocomplete, searchable select, dictionary input

```sberDesigner
{
  "descriptionLayer": {
    "componentId": "molecules-inputs-inputautocomplete",
    "componentName": "InputAutocomplete",
    "purpose": "Autocomplete input for selecting one or multiple options from local or async dictionaries, with edit and read display modes.",
    "whenToUse": [
      "dictionary lookup field",
      "searchable select",
      "multi-select tags",
      "async option loading",
      "read-only display of selected values"
    ],
    "whenNotToUse": [],
    "variantGuidance": [
      {
        "prop": "multiple",
        "values": [
          {
            "value": "false",
            "meaning": "single value"
          },
          {
            "value": "true",
            "meaning": "multi-select"
          }
        ]
      },
      {
        "prop": "viewType",
        "values": [
          {
            "value": "edit",
            "meaning": "interactive field"
          },
          {
            "value": "read",
            "meaning": "display-only value"
          }
        ]
      },
      {
        "prop": "viewFormat",
        "values": [
          {
            "value": "text",
            "meaning": "plain single/read value"
          },
          {
            "value": "chip",
            "meaning": "selected values as chips"
          },
          {
            "value": "marker",
            "meaning": "compact read markers"
          },
          {
            "value": "outerChip",
            "meaning": "selected chips rendered below the input"
          }
        ]
      },
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "dense"
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
      }
    ],
    "requiredProps": [
      "value",
      "getOptionLabel",
      "getOptionIdentifier or isOptionEqualToValue when values are objects"
    ],
    "canonicalUsage": "<InputAutocomplete value={value} options={options} getOptionLabel={getOptionLabel} getOptionIdentifier={getOptionIdentifier} multiple={false} viewType=\"edit\" size=\"md\" />",
    "keywords": [
      "autocomplete",
      "searchable select",
      "dictionary input"
    ],
    "status": "confirmed"
  }
}
```
