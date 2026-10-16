# ErrorSection

## Description for AI

**Purpose:** Error display section rendering a reason-appropriate illustration and message, with optional action buttons.
**Use when:**
- error fallback
- permission denied page
- not-found states
- module unavailable states
**Variants:**
- `reason`: `Forbidden` — access denied; `NotFound` — resource missing; `ServerFail` — backend error; `FrontendFail` — client error; `NothingHereYet` — empty/not-yet-built state
- `size`: `sm` — compact section; `md` — standard section; `lg` — full-page section
**Required props:** `reason`
**Keywords:** error section, error display, error illustration

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Error display section rendering a reason-appropriate illustration and message, with optional action buttons.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "error section",
      "error display",
      "error illustration"
    ],
    "whenToUse": [
      "error fallback",
      "permission denied page",
      "not-found states",
      "module unavailable states"
    ],
    "variantGuidance": [
      {
        "prop": "reason",
        "values": [
          {
            "value": "Forbidden",
            "meaning": "access denied"
          },
          {
            "value": "NotFound",
            "meaning": "resource missing"
          },
          {
            "value": "ServerFail",
            "meaning": "backend error"
          },
          {
            "value": "FrontendFail",
            "meaning": "client error"
          },
          {
            "value": "NothingHereYet",
            "meaning": "empty/not-yet-built state"
          }
        ]
      },
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "compact section"
          },
          {
            "value": "md",
            "meaning": "standard section"
          },
          {
            "value": "lg",
            "meaning": "full-page section"
          }
        ]
      }
    ],
    "requiredProps": [
      "reason"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T19:06:03.359Z"
  }
}
```
