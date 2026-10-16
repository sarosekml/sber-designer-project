# Avatar

## Description for AI

**Purpose:** User or entity avatar — renders initials from name, an icon, or an image with circular/rounded/square shape and configurable size.
**Use when:**
- user profile icon
- entity card
- table row person cell
- avatar group for assignees
**Variants:**
- `variant`: `circular` — default round shape; `rounded` — soft corners; `square` — sharp corners
- `size`: `sm` — small; `md` — medium (default); `lg` — large; `xl` — extra large
**Keywords:** avatar, user icon, profile circle
**Do / Don't:**
- children (initials/icon/image) or name prop triggers auto-initials
- no strictly required props

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "User or entity avatar — renders initials from name, an icon, or an image with circular/rounded/square shape and configurable size.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [
      "children (initials/icon/image) or name prop triggers auto-initials",
      "no strictly required props"
    ],
    "schemaVersion": 1,
    "keywords": [
      "avatar",
      "user icon",
      "profile circle"
    ],
    "whenToUse": [
      "user profile icon",
      "entity card",
      "table row person cell",
      "avatar group for assignees"
    ],
    "variantGuidance": [
      {
        "prop": "variant",
        "values": [
          {
            "value": "circular",
            "meaning": "default round shape"
          },
          {
            "value": "rounded",
            "meaning": "soft corners"
          },
          {
            "value": "square",
            "meaning": "sharp corners"
          }
        ]
      },
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "small"
          },
          {
            "value": "md",
            "meaning": "medium (default)"
          },
          {
            "value": "lg",
            "meaning": "large"
          },
          {
            "value": "xl",
            "meaning": "extra large"
          }
        ]
      }
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T18:58:22.470Z"
  }
}
```
