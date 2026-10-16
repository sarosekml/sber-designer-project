# BadgeCounter

## Description for AI

**Purpose:** Small numeric badge indicating count of items, notifications, or pending actions.
**Use when:**
- show unread/active count on tabs, icons, or nav items
- indicate pending items or filtered results count
**Variants:**
- `size`: `sm` — small badge for inline/icon overlay; `md` — default badge for standalone use
**Required props:** `counter`
**Keywords:** badge, counter, notification, unread count

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Small numeric badge indicating count of items, notifications, or pending actions.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "badge",
      "counter",
      "notification",
      "unread count"
    ],
    "whenToUse": [
      "show unread/active count on tabs, icons, or nav items",
      "indicate pending items or filtered results count"
    ],
    "variantGuidance": [
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "small badge for inline/icon overlay"
          },
          {
            "value": "md",
            "meaning": "default badge for standalone use"
          }
        ]
      }
    ],
    "requiredProps": [
      "counter"
    ],
    "evidence": [
      {
        "source": "mined",
        "ref": "get_usage_card"
      },
      {
        "source": "source",
        "ref": "src/components/atoms/BadgeCounter/BadgeCounter.stories.tsx"
      }
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-16T18:54:39.134Z"
  }
}
```
