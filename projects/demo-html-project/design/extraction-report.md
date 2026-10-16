# Extraction Report — IBP Design System Scout

**Proposal ID:** `style-scout-0114-live-20260723`  
**Date:** 2026-07-23  
**Source:** Live project design-system source (`design-system/styles/*.css`, `design-system/tokens.css`, `design-system/components.css`)  
**Method:** Direct source inspection of 15+ foundation and component CSS files.

---

## 1. Evidence Sources

| File | Lines | Evidence Type |
|------|-------|--------------|
| `design-system/styles/colors.css` | 247 | Full palette — 10 primitive ramps, 4 semantic categories, Local status ramps, chart colors |
| `design-system/styles/typography.css` | 107 | 3 font families, 3 weights, 22 type-ramp tokens, 22 utility classes |
| `design-system/styles/radius.css` | 34 | 13-step primitive ramp + 8 semantic aliases |
| `design-system/styles/shadow.css` | 23 | 5 elevation levels + 1 modal shadow |
| `design-system/styles/button.css` | 115 | Accent/outline/transparent/danger types, m/s/xs sizes, hover/active/disabled/loading states |
| `design-system/styles/chip.css` | 213 | Fill/outline/solid styles, l/m/s/xs sizes, 7 tones, icon/marker/remove/dropdown/info slots, chiplist wrapper |
| `design-system/styles/badge.css` | 119 | Counter/dot types, m/s/xs/xxs sizes, 6 tones, text/bordered/muted variants, badge-anchor overlay |
| `design-system/styles/input.css` | 150 | Text/date/autocomplete, m/s sizes, error/warning/disabled, prefix/postfix/chips/actions |
| `design-system/styles/link.css` | 120 | Accent/muted/neutral tones, m/s sizes, inline/external/truncate, visited support |
| `design-system/styles/alert.css` | 135 | Info/warning/error/success tones, m/s sizes, icon/title/text/buttons/actions, collapse |
| `design-system/styles/tooltip.css` | 120 | Main/error types, 4 placements × 3 alignments, floating/pinned, no-arrow |
| `design-system/styles/modal.css` | 200 | 12-step width scale, head/body/foot anatomy, scrim, skeleton loading, scroll shadows |
| `design-system/styles/tab.css` | 246 | Horiz/vert orientation, m/s sizes, overflow scroll + menu patterns, badge slot, indicator |
| `design-system/styles/snackbar.css` | 137 | 4 tones, fixed layer, 3-column grid, enter/leave animation |
| `design-system/styles/entity.css` | 295 | s/m/l sizes, icon/avatar/checkbox lead, label/subheaders/chips/actions |
| `design-system/styles/avatar.css` | 133 | xl/l/m/s sizes, circular/rounded, text/icon/image, group support |
| `design-system/styles/breadcrumbs.css` | 101 | Single size (Body S), muted/neutral link tones, condensed/truncated |
| `design-system/styles/divider.css` | 102 | h/v directions, strong/dashed/inset/section, label support |
| `design-system/styles/segment-control.css` | 187 | m/s/xs sizes, floating thumb, radiogroup semantics |

---

## 2. Extracted Colors

### 2.1 Primitive Ramps (92 tokens total)

**Mono/Greys (9):** `--c-mgrey-50` (#FFFFFF) through `--c-cgrey-900` (#131618)  
**Swamp (10):** `--c-swamp-50` (#EEF2F1) through `--c-swamp-a700` (#DEEDEC)  
**Emerald (7):** `--c-emerald-100` (#CDE2E0) through `--c-emerald-900` (#00635A)  
**Red (7):** `--c-red-200` (#E57373) through `--c-red-a400` (#F6D8D7)  
**Amber (8):** `--c-amber-50` (#FFF8E1) through `--c-amber-a200` (#FCE9AE)  
**Green (5):** `--c-lightgreen-50` through `--c-green-800`  
**Blue (6):** `--c-lightblue-50` through `--c-blue-200`  
**Purple (4):** `--c-deeppurple-50` through `--c-deeppurple-900`  
**Orange (2):** `--c-orange-50` (#FFF3E0), `--c-orange-200` (#FFCC80)

### 2.2 Semantic Categories (101 tokens)

- **Static (22):** bg, border, text, bgtable tokens
- **Active (10):** primary, secondary, tertiary with dark/light/bg variants
- **Situative (18):** error, warning, success, info, link, disabled ramps
- **Local (45):** 9 status families × 5-step opacity ramps (dark, base, mid, midlight, light)
- **Rate (8):** green, blue, purple, orange with light variants
- **Chart (12):** named visualization colors

---

## 3. Extracted Typography

### Font Families (3)

| Family | Files | Weights |
|--------|-------|---------|
| SB Sans Display | `.otf` × 3 | 300, 400, 600 |
| SB Sans Text | `.otf` × 2 | 400, 600 |
| SB Sans Screen | `.otf` × 1 | 400 |

### Type Ramp (22 tokens)

- 10 heading levels (h1–h6, each with strong variant for h3–h6)
- 9 body levels (xl/xl-strong through xs)
- 3 button levels (m/s/xs)

### Utility Classes (22)

All use `font:` shorthand + `letter-spacing: 0` + `margin: 0`.

---

## 4. Extracted Spacing

No global spacing scale found. Spacing is component-scoped:

| Scope | Values |
|-------|--------|
| Button | gap: 4/6/8px, px: 8/12/16px |
| Chip | gap: 4/6/8px, px: 8/10/12/14px |
| Input | gap: 6/8px, px: 10/12px |
| Modal | pad-x: 28px, head-y: 22px, body-y: 28px, foot-y: 20px, gap: 16px |
| Alert | pad: 16px (M), 12px/14px (S), gap: 12px (M), 10px (S) |
| Divider | inset: 16px, label-gap: 12px, section: 8px, vmin: 16px |
| Chiplist | gap: 8px (default), 6px (compact) |

---

## 5. Extracted Layout Patterns

| Pattern | Evidence |
|---------|----------|
| **BEM naming** | Every component follows `.block__element--modifier` consistently |
| **Scoped custom properties** | `--btn-h`, `--chip-gap`, `--e-lead` etc. per size modifier |
| **color-mix() state layers** | Universal hover/focus pattern: `color-mix(in srgb, var(--primary) X%, transparent)` |
| **Uniform focus ring** | `outline: 2px solid var(--primary); outline-offset: 2px` |
| **Uniform transitions** | `0.15s ease` on most properties; `0.7s linear` on spinners |
| **Reduced motion** | Every animated element has `@media (prefers-reduced-motion)` guard |
| **Flexbox-first** | All internal component layout uses flex; snackbar uses grid |
| **Gradient page background** | `linear-gradient(180deg, #F5F7F7 0%, #F2F7F7 100%)` |
| **Z-index scale** | Documented layers: 30–40 (menus), 40–60 (toasts), 1000 (modal), 9900 (snackbar) |

---

## 6. Extracted Component Patterns

| Component | Block | Sizes | Key Variants | States |
|-----------|-------|-------|-------------|--------|
| Button | `.btn` | m, s, xs | accent, outline, transparent, danger, fullwidth, icon-only | hover, active, disabled, loading |
| Chip | `.chip` | l, m, s, xs | fill, outline, solid; 7 tones | default, hover, selected, disabled, loading, invalid |
| Badge | `.badge` | m, s, xs, xxs | counter, dot; 6 tones; text, bordered, muted | default, animated |
| Tab | `.tab` | m, s | horiz, vert; selected; icon + badge slots | default, hover, selected, disabled |
| Input | `.inp` | m, s | text, date, autocomplete; prefix/postfix/chips | default, hover, focus, error, warning, disabled |
| Link | `.link` | m, s | accent, muted, neutral; inline, external, truncate | default, hover, active, visited, disabled |
| Alert | `.alert` | m, s | info, warning, error, success | default, collapsed |
| Tooltip | `.tip` | — | main, error; 4 placements × 3 alignments; floating | visible, hidden |
| Modal | `.modal` | w1–w12 | head/body/foot; skeleton loading | default, saving |
| SnackBar | `.snack` | — | info, warning, error, success | enter, leave |
| Entity | `.entity` | s, m, l | inline; icon/avatar/checkbox lead | default, skeleton, selectable |
| Avatar | `.av` | xl, l, m, s | circular, rounded; text/icon/image | default |
| Breadcrumbs | `.crumbs` | — | condensed, truncated | default, hover |
| Divider | `.dvd` | — | h, v; strong, dashed, inset, middle, section, label | — |
| SegmentControl | `.segctrl` | m, s, xs | fullwidth; floating thumb | default, hover, selected, disabled |

---

## 7. Assumptions

| # | Assumption | Confidence | Basis |
|---|-----------|-----------|-------|
| A1 | The `ds.css` entrypoint is the single source of truth for product screens | High | Comment in ds.css: "единая точка подключения стилей для экранов" |
| A2 | Component documentation pages under `design-system/pages/` are reference examples, not product screens | High | Comment in ds.css: "страницы-документация компонентов подключают styles/* точечно" |
| A3 | Screen template is `_template/Screen.html` | High | Project index summary and agent instructions |
| A4 | Icons use `data-icon` attributes rendered by `scripts/ds-icons.js` | High | Observed in catalog pages and chip.css reference to ds-icons.js |
| A5 | No page-level grid system is provided; layout is screen author's responsibility | Medium | Absence of grid tokens/layout CSS in any foundation file |
| A6 | Spacing follows an implicit 4px base unit | Medium | Component token values: 4/6/8/10/12/14/16/20/24/28/32/40 — all multiples of 2, mostly 4 |
| A7 | The system is desktop-first with no mobile breakpoints | High | No `@media` width breakpoints found; all responsive behavior is component-internal (overflow, truncation) |

---

## 8. Confidence Assessment

| Section | Confidence | Notes |
|---------|-----------|-------|
| Color Palette | **High** | Complete source inspection of colors.css; every value is exact |
| Typography | **High** | Complete source inspection of typography.css; font files confirmed |
| Radius | **High** | Complete source inspection of radius.css |
| Shadow/Elevation | **High** | Complete source inspection of shadow.css |
| Button | **High** | Full source inspection; all states documented |
| Chip | **High** | Full source inspection; proposed states noted in source comments |
| Badge | **High** | Full source inspection |
| Input | **High** | Full source inspection |
| Link | **High** | Full source inspection |
| Alert | **High** | Full source inspection |
| Tooltip | **High** | Full source inspection |
| Modal | **High** | Full source inspection |
| Tab | **High** | Full source inspection |
| SnackBar | **High** | Full source inspection |
| Entity | **High** | Full source inspection |
| Avatar | **High** | Full source inspection |
| Breadcrumbs | **High** | Full source inspection |
| Divider | **High** | Full source inspection |
| SegmentControl | **High** | Full source inspection |
| Layout / Spacing | **Medium** | No global spacing scale; component-internal tokens are exact but page-level spacing is inferred |
| Responsive Behavior | **Medium** | No breakpoint system; component-level overflow/truncation patterns are exact |
| Page Grid | **Low** | No evidence of a page grid; this is an explicit gap |

---

## 9. Conflicts with Current Project

| Conflict | Severity | Notes |
|----------|----------|-------|
| Project index is stale | Low | Project index fingerprint shows tracked files changed; proposal is derived from live source, not index |
| No existing DESIGN.md to conflict with | None | This is a style-scout proposal; it does not overwrite any active design document |

---

## 10. Omitted Values

| Omission | Reason |
|----------|--------|
| Icon names catalog | Icons are project-specific; `get_indexed_icon` / `icon-candidates.jsonl` is the runtime source |
| Font file binary content | Binary `.otf` files are referenced by path only |
| Component interaction JavaScript | Not part of CSS design system; JS behavior is documented in component page HTML |
| Toast/ToastBar component | Referenced in z-index scale and snackbar comments but not separately read; scoped to snackbar |
| Checkbox/Radio/Switch styles | Source files exist in `design-system/styles/` but were not read in detail; component pattern is consistent |
| ProgressBar | Source file exists but not read in detail |
| IconButton | Source file exists but not read in detail |
| ButtonGroup | Source file exists but not read in detail |
| LabelHelper | Source file exists but not read in detail |
| ContextMenu | Source file exists but not read in detail |
| DropdownList | Source file exists but not read in detail |
| ReadOnlyField | Source file exists but not read in detail |
| Pagination | Source file exists but not read in detail |
| Splitter | Source file exists but not read in detail |
| Popover | Source file exists but not read in detail |
| TableCell | Source file exists but not read in detail |

---

## 11. Fields Needing Human Review

| # | Field | Question | Confidence |
|---|-------|----------|------------|
| R1 | Page-level grid | Should the design system define a 12-column grid, or is layout entirely freeform? | Low |
| R2 | Responsive breakpoints | Should mobile/tablet breakpoints be defined, or is this intentionally desktop-only? | Low |
| R3 | Global spacing scale | Should `--space-2xs` through `--space-3xl` tokens be added, or is component-scoped spacing sufficient? | Medium |
| R4 | Chip proposed states | Chip source marks `selected`, `focus`, `loading`, `error/invalid`, and `solid` tones as "PROPOSED". Should these be promoted to confirmed? | Medium |
| R5 | Elevation 3–5 | Source comments say these are "reserved for future use." Should they remain reserved or be assigned? | Low |
| R6 | Chart colors | The 12 chart colors are extracted but not validated against actual chart usage. Are these the canonical chart palette? | Medium |
| R7 | Rate tokens | `--rate-*` tokens exist but usage is unclear. Are these for star ratings, risk ratings, or something else? | Medium |
| R8 | Button hover-bg uses `#fff` not `--bg-tile` | The `--btn-hover-bg` token mixes `var(--primary)` with literal `#fff` instead of `var(--bg-tile)`. Is this intentional? | Medium |
