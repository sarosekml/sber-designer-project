# IBP Design System — Project Style Contract

> Extracted from live design-system source (`design-system/styles/*.css`, `design-system/tokens.css`, `design-system/components.css`).
> Proposal ID: `style-scout-0114-live-20260723`

---

## 1. Visual Theme & Atmosphere

**Professional enterprise tooling with a calm, analytical tone.** The IBP Design System serves operational dashboards, deal pipelines, risk monitors, and data-dense work surfaces. It is not playful, not marketing-forward, and never decorative for its own sake.

**Key atmospheric traits:**

- **Muted cool palette.** Surfaces are off-white with a subtle cool-green undertone (Swamp family). The brand accent is Emerald teal — restrained, not shouting.
- **High information density without clutter.** Typography is compact (body-s at 14px is common), spacing is tight but tokenized, and every pixel serves a scanning or decision-making purpose.
- **Flat + soft elevation.** Cards and surfaces sit on gentle off-white-to-barely-green gradients. Elevation is conveyed through thin borders and soft shadows, never heavy drop shadows or dramatic layering.
- **Monochromatic depth.** Most UI chrome (borders, dividers, disabled states, tertiary fills) is drawn from the Swamp grey-green ramp. Situational color (red, amber, green, blue) appears sparingly — only for status, alerts, and destructive actions.
- **Type-forward hierarchy.** Three custom font families (Display / Text / Screen) create clear information architecture without relying on color alone.

---

## 2. Color Palette & Roles

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
| `--bg-tile` | `#FFFFFF` | Cards, tiles, input fields |
| `--bg-mainmenu` | `#FEFEFE` | Side navigation |
| `--bg-hint` | `#283237` | Tooltip background |
| `--bg-page` | `linear-gradient(180deg, #F5F7F7 0%, #F2F7F7 100%)` | Page canvas |
| `--border-primary` | `#B8CCCC` | Default field borders |
| `--border-light` | `#E1EDE7` | Subtle separators, table borders |
| `--border-dark` | `#6C8080` | Strong separators |
| `--text-primary` | `#324844` | Body copy, labels |
| `--text-secondary` | `#6C8080` | Help text, metadata |
| `--text-inactive` | `#AAB2B1` | Placeholders, disabled text |
| `--text-black` | `#283237` | Headings, emphasis |
| `--text-on-tertiary` | `#617C7C` | Text on swamp backgrounds |
| `--text-on-dark` | `#FFFFFF` | Text on accent/dark fills |

#### Active — interactive elements

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#00AA9B` | Primary buttons, selected states, focus rings |
| `--primary-dark` | `#007A6D` | Primary hover |
| `--primary-light` | `#58DCCC` | Primary light accent |
| `--primary-bg` | `color-mix(… emerald-500 6%, transparent)` | Hover/focus state layer |
| `--secondary` | `#B8D6D3` | Secondary buttons |
| `--tertiary` | `#E5ECEB` | Tertiary fills, section dividers |

#### Situative — status & feedback

| Token | Value | Usage |
|-------|-------|-------|
| `--error` | `#E5625C` | Destructive actions, error borders |
| `--warning` | `#FFB300` | Warning states |
| `--success` | `#7CB342` | Success confirmations |
| `--info` | `#1E88E5` | Informational highlights |
| `--link` | `#00AA9B` | Inline links |
| `--disabled` | `#BEC5C8` | Disabled fills |

#### Local — component-specific status ramps

Each status color has a 5-step opacity ramp: `dark` (solid), base, `mid` (56%), `midlight` (32%), `light` (16%). Available status families: `--st-green-*`, `--st-lblue-*`, `--st-orange-*`, `--st-red-*`, `--st-dpurple-*`, `--st-grey-*`, `--st-system-*`, `--st-disabled-*`, `--st-primary-*`.

#### Chart palette

Twelve named chart colors (`--chart-red`, `--chart-orange`, `--chart-yellow`, `--chart-shiny-green`, `--chart-pastel-green`, `--chart-turquoise`, `--chart-light-blue`, `--chart-blue`, `--chart-indigo`, `--chart-purple`, `--chart-pale-purple`, `--chart-pink-purple`) for data visualization.

---

## 3. Typography Rules

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
| `--type-h5-strong` | 600 | 18px / 24px | `.ds-h5-strong` |
| `--type-h5` | 400 | 18px / 24px | `.ds-h5` |
| `--type-h6-strong` | 600 | 16px / 20px | `.ds-h6-strong` |
| `--type-h6` | 400 | 16px / 20px | `.ds-h6` |

#### Body (SB Sans Text)

| Token | Weight | Size / Line-height | Utility class |
|-------|--------|--------------------|---------------|
| `--type-body-xl` | 400 | 24px / 32px | `.ds-body-xl` |
| `--type-body-xl-strong` | 600 | 24px / 32px | `.ds-body-xl-strong` |
| `--type-body-l` | 400 | 18px / 24px | `.ds-body-l` |
| `--type-body-l-strong` | 600 | 18px / 24px | `.ds-body-l-strong` |
| `--type-body-m` | 400 | 16px / 20px | `.ds-body-m` |
| `--type-body-m-strong` | 600 | 16px / 20px | `.ds-body-m-strong` |
| `--type-body-s` | 400 | 14px / 16px | `.ds-body-s` |
| `--type-body-s-strong` | 600 | 14px / 16px | `.ds-body-s-strong` |
| `--type-body-xs` | 400 | 12px / 16px | `.ds-body-xs` |

#### Buttons (SB Sans Screen)

| Token | Weight | Size / Line-height | Utility class |
|-------|--------|--------------------|---------------|
| `--type-button-m` | 400 | 16px / 24px | `.ds-button-m` |
| `--type-button-s` | 400 | 14px / 20px | `.ds-button-s` |
| `--type-button-xs` | 400 | 12px / 16px | `.ds-button-xs` |

### 3.3 Universal Rules

- **Letter-spacing: 0** across the entire system.
- **Margins: 0** on all heading/body utility classes (set by layout, not by type).
- **Tabular nums** used on counters, badges, and numeric data (`font-variant-numeric: tabular-nums`).
- **Text wrapping** in alerts and tooltips uses `text-wrap: pretty`.

---

## 4. Component Stylings

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
--btn-hover-bg:  color-mix(in srgb, var(--primary) 10%, #fff);
--btn-active-bg: color-mix(in srgb, var(--primary) 18%, #fff);
```

### 4.4 Focus Ring

All interactive elements share one focus style:

```css
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

Exceptions: inline links use underline instead of outline; modal close uses `outline-offset: 1px`.

### 4.5 Transition Speed

Uniform `0.15s ease` on color, background, border, and box-shadow transitions. Loading spinners use `0.7s linear`. Entry/exit animations use `0.18s–0.2s ease`.

### 4.6 Reduced Motion

Every animation and transition has a `@media (prefers-reduced-motion: reduce)` override. Spinner durations double; entry animations are disabled; transforms are removed.

### 4.7 Button Types

| Type | Class | Description |
|------|-------|-------------|
| Accent | `.btn--accent` | Filled primary (Emerald 500 background, white text) |
| Outline | `.btn--outline` | Transparent with Emerald border |
| Transparent | `.btn--transparent` | No border, Emerald text |
| Danger | `.btn--danger` + type | Red tokens, combines with any type |

### 4.8 Chip System

Chips serve as filters, tags, status indicators, and autocomplete tokens. They support:

- **Types**: edit (interactive), readonly
- **Styles**: fill (border + background), outline (border only), solid (saturated fill + white text)
- **Tones**: system (default), accent, success, info, warning, error, dark — each mapped to a Local status ramp
- **Slots**: leading icon/marker/badge/avatar, trailing remove/dropdown/info-trigger/counter
- **Extras**: rounded (999px pill), max-width 320px with ellipsis, chiplist wrapper

### 4.9 Other Key Components

| Component | Block class | Key variants |
|-----------|-------------|--------------|
| Badge | `.badge` | counter / dot, sizes m/s/xs/xxs, tones neutral/accent/success/info/warning/error, text/bordered/muted |
| Tab | `.tab` | horiz/vert orientation, m/s sizes, selected/disabled, icon + badge slots |
| Input | `.inp` | text/date/autocomplete, m/s sizes, error/warning/disabled, prefix/postfix/chips |
| Link | `.link` | accent/muted/neutral tones, m/s sizes, inline/external/truncate |
| Alert | `.alert` | info/warning/error/success tones, m/s sizes, icon/title/text/buttons/actions |
| Tooltip | `.tip` | main/error types, top/bottom/left/right placement, start/center/end alignment |
| Modal | `.modal` | 12-step width scale (140px–1820px), head/body/foot anatomy, skeleton loading |
| SnackBar | `.snack` | info/warning/error/success tones, fixed layer at top-right |
| Entity | `.entity` | s/m/l sizes, icon/avatar/checkbox lead, label/subheaders/chips/actions |
| Avatar | `.av` | xl/l/m/s sizes, circular/rounded, text/icon/image content |
| Breadcrumbs | `.crumbs` | single size (Body S), muted parent links + neutral current |
| Divider | `.dvd` | h/v directions, strong/dashed/inset/section modifiers, label support |
| SegmentControl | `.segctrl` | m/s/xs sizes, floating thumb indicator, radiogroup semantics |

---

## 5. Layout Principles

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

The design system does not define a page-level 12-column grid. Layout is the responsibility of the screen composer. Use the provided dividers, spacing tokens, and component width defaults to build region layouts.

### 5.5 Spacing Tokens (component-internal)

Spacing is expressed through component-scoped custom properties:

| Token | Typical values |
|-------|---------------|
| Internal gap | `--btn-gap: 8px`, `--chip-gap: 6px`, `--inp-gap: 8px` |
| Horizontal padding | `--btn-px: 16px`, `--inp-px: 12px`, `--chip-pad-x: 10px` |
| Modal pad-x | `28px` (shared by head, body, foot) |
| Chiplist gap | `8px` (default), `6px` (compact) |

### 5.6 Z-Index Scale

| Layer | Z-index | Component |
|-------|---------|-----------|
| Menus, dropdowns | 30–40 | Context menu, tooltip, popover |
| Toasts | 40–60 | Toast bar |
| Navigation overlay | 50–60 | Side nav |
| Modal scrim | 1000 | Modal |
| Nested modal | 1010 | Confirm dialog |
| SnackBar layer | 9900 | Notifications |

---

## 6. Depth & Elevation

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

- Page: grey-green gradient → Card: white → Input field: white with border
- The gradient page background is the primary depth cue for card surfaces
- Heavy shadows are reserved for floating elements (menus, tooltips, modals)

---

## 7. Do's and Don'ts

### Do

- **Use semantic token aliases** (`--text-primary`, `--primary`, `--border-light`) — never raw primitive ramp values (`--c-emerald-500`, `--c-mgrey-50`).
- **Use `color-mix()` for state layers** — `color-mix(in srgb, var(--primary) 6%, transparent)` for hover fills. Never hardcode rgba or opacity hacks.
- **Use BEM class composition** — build screens by composing `.btn--accent.btn--m`, `.chip--error.chip--s`, etc. Do not write one-off styles that duplicate component internals.
- **Respect the type ramp** — use `.ds-h4`, `.ds-body-s`, `.ds-button-m` utility classes or their token equivalents. Do not set custom `font` shorthand.
- **Keep letter-spacing at 0** — this is a system-wide constant.
- **Use the focus ring** — `outline: 2px solid var(--primary); outline-offset: 2px` on every interactive element.
- **Support reduced motion** — wrap animations in `@media (prefers-reduced-motion: no-preference)` or provide a reduced-motion override.
- **Use `font-variant-numeric: tabular-nums`** on any column of numbers.

### Don't

- **Don't use primitive color ramps directly** — `--c-emerald-500` should never appear in a product screen; use `--primary`.
- **Don't add decorative shadows** — if a surface doesn't float (tooltip, menu, modal), it doesn't get a shadow. Cards and tiles use the gradient background for separation.
- **Don't invent new font sizes** — the type ramp is fixed. If you need a size between Body S and Body M, reconsider the hierarchy.
- **Don't hardcode spacing** — component padding/gap is tokenized. Page-level spacing should prefer multiples of 4px/8px.
- **Don't use `<br>` for spacing** — use gap, margin, or padding on layout containers.
- **Don't skip the disabled state** — every interactive component has a `.block--disabled` modifier. Use it.
- **Don't mix brand colors with situational colors** — Emerald is for brand/interaction; Red/Amber/Green/Blue are for status. Never use Emerald to mean "success" or Red for a non-destructive action.
- **Don't omit `aria-label` on icon-only controls** — the system uses `<i data-icon="…">` for icons; icon-only buttons need accessible names.

---

## 8. Responsive Behavior

### 8.1 Component-Level Responsiveness

- **Buttons**: icon-only buttons never stretch to full width (`.btn--fullwidth.btn--icon-only` is overridden to `width: auto`).
- **Tabs**: horizontal overflow uses scrollable rows (`.tabs-scroll`) with optional prev/next arrows, or an overflow menu (`.tabs-overflow`) that collapses excess tabs behind a "more" trigger.
- **Modals**: width is chosen from a 12-step scale (140px–1820px). Maximum width is clamped to `100vw - 48px`. The scrim handles overflow with `overflow-y: auto`.
- **Chips/badges**: fixed max-width (320px for chips) with ellipsis truncation.
- **Links/breadcrumbs**: truncation with ellipsis at constrained widths; full text in `title` attribute for tooltip.

### 8.2 No Breakpoint System

The design system does not define `@media` breakpoints for layout. Responsive composition is left to the screen author. The foundation is designed to support dense desktop-first layouts; mobile adaptation is not pre-baked.

### 8.3 Viewport Guards

- Modal: `--modal-viewport-guard: 24px` prevents edges from touching the viewport boundary.
- SnackBar layer: fixed at `top: 24px; right: 24px`.

---

## 9. Agent Prompt Guide

When generating screens for this design system, follow these rules in order:

1. **Start from `_template/Screen.html`** and link `../design-system/ds.css` (the single entrypoint).
2. **Pick components by role, not by hardcoded name.** Use indexed component catalog with BEM class names: `.btn`, `.chip`, `.badge`, `.tab`, `.inp`, `.link`, `.alert`, `.tip`, `.modal`, `.snack`, `.entity`, `.av`, `.crumbs`, `.dvd`, `.segctrl`.
3. **Compose with modifiers.** Every component expects a size (`.btn--m`, `.chip--s`) and a tone (`.btn--accent`, `.chip--error`) where applicable.
4. **Use semantic color tokens only.** Reference `--text-primary`, `--primary`, `--border-light`, `--bg-tile`, etc. Never use `--c-emerald-500` or `--c-mgrey-50` in product markup.
5. **Use the type ramp utility classes.** Apply `.ds-h4`, `.ds-body-s`, `.ds-body-m-strong` etc. Do not write custom `font:` declarations.
6. **Apply state layers with `color-mix()`.** For custom hover/focus backgrounds that aren't covered by a component, use the pattern `color-mix(in srgb, var(--primary) 6%, transparent)`.
7. **Include loading, empty, error, and disabled states** for any data-bound region. Use existing component modifiers (`.btn--loading`, `.inp--error`, `.chip--disabled`).
8. **Test reduced motion.** Every animation needs a `@media (prefers-reduced-motion: reduce)` fallback.
9. **Respect the z-index scale.** Floating layers: tooltips/menus at 30, toasts at 40-60, modals at 1000.
10. **Use `data-icon` attributes** with the project icon runtime (`scripts/ds-icons.js`). Icons are rendered as `<i data-icon="icon-name"></i>`, not inline SVG.
11. **Keep page-local CSS minimal.** If you need a layout container, use flexbox with gap. Do not rewrite component internals.
12. **Preserve the calm, analytical tone.** No marketing hero text, no decorative flourishes, no rainbow palettes. Color appears only where it carries meaning.
