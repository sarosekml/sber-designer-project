# BreadCrumbs

## Description for AI

**Purpose:** Navigational breadcrumb trail showing the current page location within the app hierarchy, with clickable links for each level.
**Use when:**
- hierarchical page navigation (deals → structured finance → deal card)
- multi-level app sections where users need to go back
**Variants:**
- `navigationSchema`: `array of {name, route}` — Each item is a breadcrumb step. Empty route renders as plain text (current page).
**Required props:** `navigationSchema`, `onClickLink`
**Canonical usage:**
_Canonical usage_
```tsx
<BreadCrumbs
  dataTestId="DealBreadcrumbs"
  navigationSchema={[
    { name: 'Deals', route: '/deals' },
    { name: 'Structured Finance', route: '/deals/structured-finance' },
    { name: deal.id, route: `/deals/${deal.id}` },
    { name: 'СеверПром Металлургия', route: '' },
  ]}
  onClickLink={noop}
/>
```
**Keywords:** breadcrumbs, navigation trail, hierarchy path

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Navigational breadcrumb trail showing the current page location within the app hierarchy, with clickable links for each level.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "breadcrumbs",
      "navigation trail",
      "hierarchy path"
    ],
    "whenToUse": [
      "hierarchical page navigation (deals → structured finance → deal card)",
      "multi-level app sections where users need to go back"
    ],
    "variantGuidance": [
      {
        "prop": "navigationSchema",
        "values": [
          {
            "value": "array of {name, route}",
            "meaning": "Each item is a breadcrumb step. Empty route renders as plain text (current page)."
          }
        ]
      }
    ],
    "requiredProps": [
      "navigationSchema",
      "onClickLink"
    ],
    "canonicalSnippets": [
      {
        "code": "<BreadCrumbs\n  dataTestId=\"DealBreadcrumbs\"\n  navigationSchema={[\n    { name: 'Deals', route: '/deals' },\n    { name: 'Structured Finance', route: '/deals/structured-finance' },\n    { name: deal.id, route: `/deals/${deal.id}` },\n    { name: 'СеверПром Металлургия', route: '' },\n  ]}\n  onClickLink={noop}\n/>",
        "label": "Canonical usage"
      }
    ],
    "pairsWith": [
      "atoms-typography-text",
      "atoms-gridtiles-grid",
      "atoms-icon-iconlist",
      "atoms-buttons-button",
      "atoms-badgecounter"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T19:04:07.563Z"
  }
}
```
