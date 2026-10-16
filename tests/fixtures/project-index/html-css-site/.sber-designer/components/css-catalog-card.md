# Card

## Description for AI

**Purpose:** Reusable surface for highlighted content groups in static HTML pages.
**Use when:** featured content block; static page summary
**Variants:**

- `modifier`: `card--featured` — adds emphasis for a highlighted card.
  **Required props:** `card`, `card__header`, `card__body`
  **Canonical usage:**

```html
<section class="card card--featured">
  <header class="card__header">Portfolio card</header>
  <div class="card__body">Use this surface for highlighted content groups.</div>
</section>
```

**Keywords:** surface, card, featured content

<!-- Machine-managed by the sber-designer description agent. The fenced block below is the canonical structured source; edit via the agent. -->

```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Reusable surface for highlighted content groups in static HTML pages.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "whenToUse": ["featured content block", "static page summary"],
    "variantGuidance": [
      {
        "prop": "modifier",
        "values": [
          {
            "value": "card--featured",
            "meaning": "adds emphasis for a highlighted card."
          }
        ]
      }
    ],
    "requiredProps": ["card", "card__header", "card__body"],
    "canonicalSnippets": [
      {
        "code": "<section class=\"card card--featured\">\\n  <header class=\"card__header\">Portfolio card</header>\\n  <div class=\"card__body\">Use this surface for highlighted content groups.</div>\\n</section>"
      }
    ],
    "keywords": ["surface", "card", "featured content"],
    "status": "confirmed",
    "updatedAt": "2026-07-07T00:00:00.000Z"
  }
}
```
