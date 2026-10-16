# Project index prompt summary

Project: demo-html-project3
Generated: 2026-07-23T09:49:14.347Z
Components: 408
Component groups: 7
Tokens: 800
Routes: 0
Screens: 1
Icons: 1782 candidates indexed. Resolution order: project iconName contract, project assets/files, external icon references, Lucide fallback.
Project iconName values: 247. Use get_indexed_icon and icon-catalog.md; Lucide fallback is not valid for project Icon string props unless listed as project-icon-prop.
Assets: 0 indexed project assets, including 0 illustrations.

## Project style contract

Source: design-system/Design.md. Apply this project-owned style contract before inventing visual language.

### Visual Theme & Atmosphere
**Professional enterprise tooling with a calm, analytical tone.** The IBP Design System serves operational dashboards, deal pipelines, risk monitors, and data-dense work surfaces. It is not playful, not marketing-forward, and never decorative for its own sake.

**Key atmospheric traits:**

- **Muted cool palette.** Surfaces are off-white with a subtle cool-green undertone (Swamp family). The brand accent is Emerald teal — restrained, not shouting.
- **High information density without clutter.** Typography is compact (body-s at 14px is common), spacing is tight but tokenized, and every pixel serves a scanning or decision-making purpose.
- **Flat + soft elevation.** Cards and surfaces sit on gentle off-white-to-barely-green gradients. Elevation is conveyed through thin borders and soft shadows, never heavy drop shadows or dramatic layering.
- **Monochromatic depth.** Most UI chrome (borde...

### Color Palette & Roles
### 2.1 Primitive Ramps (do not use directly in product UI)

| Ramp | Role |
|------|------|
| `--c-mgrey-*` | Pure greys — surfaces and white text |
| `--c-cgrey-*` | Cool greys — text, disabled states |
| `--c-swamp-*` | Cool grey-green — borders, tertiary fills, subtle backgrounds |
| `--c-emerald-*` | Brand teal — primary actions, links, accent |
| `--c-red-*` | Destructive actions, errors, critical status |
| `--c-amber-*` | Warnings, attention states |
| `--c-lightgreen-*` / `--c-green-*` | Success, positive status |
| `--c-lightblue-*` / `--c-blue-*` | Info, neutral status |
| `--c-deeppurple-*` | Purple status ramp |
| `--c-orange-*` | Orange rate indicators |

### 2.2 Semantic Categories

#### Static — backgrounds & information display

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-popup` | `#FFFFFF` | Dropdowns, menus, popovers |
| `--bg-tile` | `#FFFFFF` | Cards...

### Typography Rules
### 3.1 Font Families

| Family | Files | Weight | Usage |
|--------|-------|--------|-------|
| **SB Sans Display** | SBSansDisplay-Light/Regular/SemiBold.otf | 300, 400, 600 | Headings h1–h6 |
| **SB Sans Text** | SBSansText-Regular/Semibold.otf | 400, 600 | Body copy, labels, metadata |
| **SB Sans Screen** | SBSansScreen.otf | 400 | Button labels, UI chrome |

### 3.2 Type Ramp

#### Headings (SB Sans Display)

| Token | Weight | Size / Line-height | Utility class |
|-------|--------|--------------------|---------------|
| `--type-h1` | 300 | 52px / 68px | `.ds-h1` |
| `--type-h2` | 300 | 42px / 52px | `.ds-h2` |
| `--type-h3-strong` | 600 | 28px / 32px | `.ds-h3-strong` |
| `--type-h3` | 400 | 28px / 32px | `.ds-h3` |
| `--type-h4-strong` | 600 | 22px / 24px | `.ds-h4-strong` |
| `--type-h4` | 400 | 22px / 24px | `.ds-h4` |
| `--type-h5-strong` | 600 | 18px / 24px | `.ds-h5-strong`...

### Component Stylings
### 4.1 Naming Convention

Strict **BEM**: `.block__element--modifier`. Every component is namespaced with a short, memorable block name (`.btn`, `.chip`, `.badge`, `.tab`, `.inp`, `.tip`, `.modal`, `.snack`, `.entity`, `.av`, `.crumbs`, `.dvd`, `.segctrl`).

### 4.2 Sizing System

Components use internal CSS custom properties scoped per size modifier:

```
.btn--m  { --btn-h: 40px; --btn-px: 16px; --btn-gap: 8px; … }
.btn--s  { --btn-h: 32px; --btn-px: 12px; --btn-gap: 6px; … }
.btn--xs { --btn-h: 24px; --btn-px: 8px;  --btn-gap: 4px; … }
```

This pattern is consistent across **Button**, **Chip**, **Badge**, **Tab**, **Input**, **Avatar**, **SegmentControl**.

### 4.3 State Layer Pattern

Hover and focus states use `color-mix()` over transparent to create a universal state layer that composites correctly on any background:

```css
--btn-hover-bg:  color-mix(in srgb, var(--primary) 10%...

### Layout Principles
### 5.1 Page Canvas

The page background is a subtle cool gradient:

```css
background: linear-gradient(180deg, #F5F7F7 0%, #F2F7F7 100%);
```

Content surfaces (cards, tiles, inputs, popups) are white (`--bg-tile: #FFFFFF`), creating a gentle layered effect without heavy shadows.

### 5.2 Content Density

This is a **data-dense** system. Default body text is 14px (`--type-body-s`). Tables, lists, and operational views pack information tightly while respecting minimum touch targets (24px minimum interactive height via `btn--xs`, `chip--xs`, `badge--xxs`).

### 5.3 Internal Layout Primitive

All components use **Flexbox** internally. The modal and snackbar use **CSS Grid** for specific anatomy (modal: vertical flex column; snackbar: 3-column grid for icon/body/close).

### 5.4 No Global Page Grid

The design system does not define a page-level 12-column grid. Layout is the responsibility...

### Depth & Elevation
### 6.1 Elevation System

Five named levels, plus one special modal shadow:

| Token | Value | Assigned to |
|-------|-------|-------------|
| `--elevation-1` | `0 1px 2px rgba(40,50,55,.28)` | Switch thumb |
| `--elevation-2` | `0 10px 30px rgba(40,50,55,.16)` | Tooltips, context menus, dropdowns |
| `--elevation-3` | `0 14px 38px rgba(40,50,55,.18)` | Reserved |
| `--elevation-4` | `0 18px 48px rgba(40,50,55,.20)` | Reserved |
| `--elevation-5` | `0 22px 58px rgba(40,50,55,.22)` | Reserved |
| `--shadow-modal-form` | `0 24px 64px rgba(40,50,55,.28)` | Modal windows, sheets |

All shadows use a single dark cool-grey color (`rgba(40,50,55,…)`) at varying opacities and spreads. This keeps the lighting model unified.

### 6.2 Depth Through Color, Not Shadow

Most depth separation is achieved through **color contrast**, not shadow stacking:

- Page: grey-green gradient → Card: white → Inpu...

### Do's and Don'ts
### Do

- **Use semantic token aliases** (`--text-primary`, `--primary`, `--border-light`) — never raw primitive ramp values (`--c-emerald-500`, `--c-mgrey-50`).
- **Use `color-mix()` for state layers** — `color-mix(in srgb, var(--primary) 6%, transparent)` for hover fills. Never hardcode rgba or opacity hacks.
- **Use BEM class composition** — build screens by composing `.btn--accent.btn--m`, `.chip--error.chip--s`, etc. Do not write one-off styles that duplicate component internals.
- **Respect the type ramp** — use `.ds-h4`, `.ds-body-s`, `.ds-button-m` utility classes or their token equivalents. Do not set custom `font` shorthand.
- **Keep letter-spacing at 0** — this is a system-wide constant.
- **Use the focus ring** — `outline: 2px solid var(--primary); outline-offset: 2px` on every interactive element.
- **Support reduced motion** — wrap animations in `@media (prefers-reduced-mo...

### Responsive Behavior
### 8.1 Component-Level Responsiveness

- **Buttons**: icon-only buttons never stretch to full width (`.btn--fullwidth.btn--icon-only` is overridden to `width: auto`).
- **Tabs**: horizontal overflow uses scrollable rows (`.tabs-scroll`) with optional prev/next arrows, or an overflow menu (`.tabs-overflow`) that collapses excess tabs behind a "more" trigger.
- **Modals**: width is chosen from a 12-step scale (140px–1820px). Maximum width is clamped to `100vw - 48px`. The scrim handles overflow with `overflow-y: auto`.
- **Chips/badges**: fixed max-width (320px for chips) with ellipsis truncation.
- **Links/breadcrumbs**: truncation with ellipsis at constrained widths; full text in `title` attribute for tooltip.

### 8.2 No Breakpoint System

The design system does not define `@media` breakpoints for layout. Responsive composition is left to the screen author. The foundation is designed...

### Agent Prompt Guide
When generating screens for this design system, follow these rules in order:

1. **Start from `_template/Screen.html`** and link `../design-system/ds.css` (the single entrypoint).
2. **Pick components by role, not by hardcoded name.** Use indexed component catalog with BEM class names: `.btn`, `.chip`, `.badge`, `.tab`, `.inp`, `.link`, `.alert`, `.tip`, `.modal`, `.snack`, `.entity`, `.av`, `.crumbs`, `.dvd`, `.segctrl`.
3. **Compose with modifiers.** Every component expects a size (`.btn--m`, `.chip--s`) and a tone (`.btn--accent`, `.chip--error`) where applicable.
4. **Use semantic color tokens only.** Reference `--text-primary`, `--primary`, `--border-light`, `--bg-tile`, etc. Never use `--c-emerald-500` or `--c-mgrey-50` in product markup.
5. **Use the type ramp utility classes.** Apply `.ds-h4`, `.ds-body-s`, `.ds-body-m-strong` etc. Do not write custom `font:` declarations.
6. **...

## Component groups

### Tables and lists
Use for dense data, sortable lists, table pages and bulk actions.
Components: css-catalog-cat-row, css-catalog-cc-grid, css-catalog-chiplist, css-catalog-clist, css-catalog-compo-grid, css-catalog-compo-list, css-catalog-content-table, css-catalog-cref-row, css-catalog-cref-rows, css-catalog-demo-grid, css-catalog-demo-rowlabel, css-catalog-demo-rows, css-catalog-dev-table, css-catalog-ex-grid, css-catalog-eyebrow, css-catalog-feeder-grid, css-catalog-fw-grid, css-catalog-grid

### Forms and inputs
Use for collecting data, filters and editable settings.
Components: css-catalog-field-mock, css-catalog-input-mock, css-catalog-mfield, css-catalog-pg-select, css-catalog-search

### Navigation
Use for sidebars, breadcrumbs, tabs, menus and route surfaces.
Components: css-catalog-menu, css-catalog-sd-tabular, css-catalog-tabs

### Actions
Use for commands, primary actions and contextual controls.
Components: css-catalog-link, css-catalog-mock-toolbar, css-catalog-pv-link, css-catalog-toolbar

### Status and feedback
Use for priorities, state badges, validation and async feedback.
Components: css-catalog-alert, css-catalog-badge, css-catalog-badge-new, css-catalog-badge-proposal, css-catalog-empty, css-catalog-status, css-catalog-toast

### Layout and surfaces
Use for page structure, panels, dialogs and repeated content surfaces.
Components: css-catalog-a, css-catalog-adapt-resize, css-catalog-adapt-tiers, css-catalog-addon, css-catalog-ag, css-catalog-alpha, css-catalog-anat, css-catalog-anat2, css-catalog-anat-dia, css-catalog-av, css-catalog-av-group, css-catalog-av-size, css-catalog-b, css-catalog-backlog, css-catalog-bad, css-catalog-base-cls, css-catalog-beh, css-catalog-bg-accent

### Data visualization
Use for metrics, trends, charts and analytical summaries.
Components: css-catalog-btn-states, css-catalog-mock-chart, css-catalog-sd-state-layer, css-catalog-stat, css-catalog-state-cls, css-catalog-states, css-catalog-states-sep

## High-signal components

- CSS/A (design-system/refs/imported-index.html)
- CSS/AdaptResize (design-system/pages/molecules/Pagination.html)
- CSS/AdaptTiers (design-system/pages/molecules/Pagination.html)
- CSS/Addon (design-system/pages/atoms/Buttons.html)
- CSS/Ag (design-system/refs/imported-index.html)
- CSS/Alert (design-system/refs/imported-index.html)
- CSS/Alpha (design-system/pages/atoms/Buttons.html)
- CSS/Anat (design-system/pages/atoms/Avatar.html)
- CSS/Anat2 (design-system/pages/loading/LabelHelper.html)
- CSS/AnatDia (design-system/pages/atoms/Avatar.html)
- CSS/Av (design-system/pages/atoms/Avatar.html)
- CSS/AvGroup (design-system/refs/imported-index.html)
- CSS/AvSize (design-system/pages/organisms/Entity.html)
- CSS/B (design-system/refs/imported-index.html)
- CSS/Backlog (design-system/pages/molecules/InputAutocomplete.html)
- CSS/Bad (design-system/pages/atoms/Avatar.html)
- CSS/Badge (design-system/pages/atoms/IconButton.html)
- CSS/BadgeNew (design-system/pages/atoms/Avatar.html)
- CSS/BadgeProposal (design-system/pages/atoms/ProgressBar.html)
- CSS/BaseCls (design-system/pages/organisms/TableCell.html)
- CSS/Beh (design-system/pages/patterns/SectionsAudit.html)
- CSS/BgAccent (design-system/pages/organisms/TableCell.html)
- CSS/BgPinned (design-system/pages/organisms/TableCell.html)
- CSS/Blk (design-system/pages/molecules/ButtonGroup.html)

## CSS catalog manifest

- 416 CSS catalog components, 962 classes, 1894 selectors, 482 tokens declared.
- Components: css-catalog-, css-catalog-, css-catalog-, css-catalog-, css-catalog-, css-catalog-, css-catalog-a, css-catalog-adapt-resize, css-catalog-adapt-tiers, css-catalog-addon, css-catalog-ag, css-catalog-alert, css-catalog-alpha, css-catalog-alpha, css-catalog-anat, css-catalog-anat-dia, css-catalog-anat2, css-catalog-av
- Tokens declared: accent, alert-accent, alert-body-gap, alert-gap, alert-icon, alert-pad, alert-surface, av-font, av-icon, av-overlap, av-round, av-size, bdg-font, bdg-pad, bdg-size, bg-hint, bg-mainmenu, bg-page
- Distillation prep: 40 value frequencies, 45 class frequencies, 0 inline styles.
Top values: 0 (spacing, 218x), 100% (spacing, 101x), var(--text-inactive) (color, 98x), var(--primary) (color, 61x), var(--text-secondary) (color, 61x), 0 (typography, 60x), 8px (spacing, 56x), transparent (color, 53x)
Top classes: .badge (8x), .badge--xs (8x), .ibtn (8x), .ibtn--m (8x), .badge--success (5x), .pgn__num (4x), .chip (3x), .chip__label (3x)

## AI component notes

No component-specific AI notes yet.

## Token hints

- btn-active-bg: color-mix(in srgb, var(--primary) 18%, #fff)
- btn-hover-bg: color-mix(in srgb, var(--primary) 10%, #fff)
- btn-pale: color-mix(in srgb, var(--primary) 45%, #fff)
- bg-hint: var(--c-cgrey-800)
- bg-mainmenu: var(--c-mgrey-100)
- bg-page: linear-gradient(180deg, #F5F7F7 0%, #F2F7F7 100%)
- bg-popup: var(--c-mgrey-50)
- bg-tile: var(--c-mgrey-50)
- bgtable: var(--c-mgrey-50)
- bgtable-accent: var(--c-amber-50)
- bgtable-accent-focus: var(--c-amber-a200)
- bgtable-accent-hover: var(--c-amber-a100)
- bgtable-pinned: var(--c-swamp-a100)
- bgtable-pinned-focus: var(--c-swamp-a700)
- bgtable-pinned-hover: var(--c-swamp-50)
- bgtable-row-focus: var(--c-swamp-a700)
- bgtable-row-focus-hover: var(--c-swamp-a700)
- bgtable-row-hover: var(--c-swamp-a400)
- border-dark: var(--c-swamp-600)
- border-light: var(--c-swamp-200)
- border-primary: var(--c-swamp-300)
- c-amber-400: #FFE54C
- c-amber-50: #FFF8E1
- c-amber-600: #FFB300

## Icon hints

- a-risk: <i data-icon="a-risk" />
- activity-heart: <i data-icon="activity-heart" />
- add: <i data-icon="add" />
- add-circle: <i data-icon="add-circle" />
- admin-ckp: <i data-icon="admin-ckp" />
- admin-panel-settings: <i data-icon="admin-panel-settings" />
- ai-stars: <i data-icon="ai-stars" />
- ai-stars-02: <i data-icon="ai-stars-02" />
- alert-circle: <i data-icon="alert-circle" />
- alert-circle-filled: <i data-icon="alert-circle-filled" />
- alert-triangle: <i data-icon="alert-triangle" />
- alert-triangle-filled: <i data-icon="alert-triangle-filled" />
- archive: <i data-icon="archive" />
- arrow-block-down-filled: <i data-icon="arrow-block-down-filled" />
- arrow-block-left: <i data-icon="arrow-block-left" />
- arrow-block-left-filled: <i data-icon="arrow-block-left-filled" />
- arrow-block-right: <i data-icon="arrow-block-right" />
- arrow-block-right-filled: <i data-icon="arrow-block-right-filled" />
- arrow-block-up-filled: <i data-icon="arrow-block-up-filled" />
- arrow-circle-down: <i data-icon="arrow-circle-down" />
- arrow-circle-down-filled: <i data-icon="arrow-circle-down-filled" />
- arrow-circle-left: <i data-icon="arrow-circle-left" />
- arrow-circle-left-filled: <i data-icon="arrow-circle-left-filled" />
- arrow-circle-right: <i data-icon="arrow-circle-right" />

## Asset hints

No indexed project assets yet.

