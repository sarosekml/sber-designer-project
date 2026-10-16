# Alert

## Description for AI

**Purpose:** Severity-based alert banner for status messages, validation errors, warnings, and success confirmations — supports title, expandable body, and action buttons.
**Use when:**
- displaying inline status messages
- validation errors
- warnings
- success confirmations
- inside forms, sections, or dashboards
**Variants:**
- `severity`: `error` — critical/blocking; `info` — informational; `success` — positive confirmation; `warning` — cautionary
**Required props:** `severity`
**Keywords:** alert, notification, banner

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Severity-based alert banner for status messages, validation errors, warnings, and success confirmations — supports title, expandable body, and action buttons.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "alert",
      "notification",
      "banner"
    ],
    "whenToUse": [
      "displaying inline status messages",
      "validation errors",
      "warnings",
      "success confirmations",
      "inside forms, sections, or dashboards"
    ],
    "variantGuidance": [
      {
        "prop": "severity",
        "values": [
          {
            "value": "error",
            "meaning": "critical/blocking"
          },
          {
            "value": "info",
            "meaning": "informational"
          },
          {
            "value": "success",
            "meaning": "positive confirmation"
          },
          {
            "value": "warning",
            "meaning": "cautionary"
          }
        ]
      }
    ],
    "requiredProps": [
      "severity"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T18:56:06.951Z"
  }
}
```
