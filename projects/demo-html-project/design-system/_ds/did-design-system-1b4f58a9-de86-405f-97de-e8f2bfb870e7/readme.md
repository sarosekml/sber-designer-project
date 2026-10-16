# DID Design System

A foundations-level design system imported from an existing product design library. Built on the **SB Sans** typeface family with an emerald/teal primary palette and a structured semantic color system. Documentation pages are authored in Russian.

## Source
Imported from a sibling design project:
`https://claude.ai/design/p/3559fe8c-30e4-4f09-9db1-ad932c969cdd`

Transferred verbatim: `styles/typography.css`, `styles/colors.css`, `styles/button.css`, and the documentation pages `Typography.html`, `Colors.html`, `Buttons.html`, plus the six SB Sans font binaries.

## What's here
- **`styles.css`** (root) — global entry point; `@import`s the three foundation files below. Consumers link this one file.
- **`styles/typography.css`** — SB Sans Display / Text / Screen `@font-face` rules, `--type-*` tokens, and `.ds-*` utility classes.
- **`styles/colors.css`** — full color foundation: primitive ramps (`--c-*`) plus semantic tokens grouped Static · Active · Situative · Local.
- **`styles/button.css`** — the Button component (types accent / outline / transparent; sizes m / s / xs; states + loader + fullwidth).
- **`fonts/`** — six SB Sans OTF binaries.
- **Docs** (root): `Typography.html`, `Colors.html`, `Buttons.html` — interactive specimen pages, tagged as Design System cards.

---

## CONTENT FUNDAMENTALS
- **Language:** documentation copy is Russian; component labels in examples use Russian ("Применить", "Действия", "Скачать PDF").
- **Tone:** precise, technical, instructional — written for designers/engineers. States rules plainly ("Ширина зависит от контента, высота фиксирована").
- **Casing:** sentence case for prose; component/token names kept in their canonical form (`Body M Strong`, `--type-button-m`).
- **Person:** impersonal/imperative ("Соберите кнопку", "Нажмите, чтобы открыть"). No first person.
- **Emoji:** none. Not part of the brand voice.
- **Vibe:** clean enterprise/fintech documentation — dense reference tables, exact pixel specs, no marketing fluff.

## VISUAL FOUNDATIONS
- **Color:** emerald/teal primary (`--primary` = `#00AA9B`, dark `#007A6D`, light `#58DCCC`). Neutrals are cool grey-greens ("Swamp" + "CGrey" ramps). Semantic system split into four buckets — Static (backgrounds/text/borders/tables), Active (primary/secondary/tertiary interactive), Situative (error/warning/success/info/link/disabled), Local (status ramps, rate chips, chart palette). Semi-transparent tokens use `color-mix(... transparent)` so they composite on any background.
- **Type:** three families — SB Sans **Display** (headings H1–H6, weights 300/400/600), SB Sans **Text** (body, 400/600), SB Sans **Screen** (button labels, 400). Letter-spacing is **0** everywhere. Type ramp encoded as `font:` shorthand tokens (`--type-h3-strong`, `--type-body-m`, etc.).
- **Backgrounds:** page background is a subtle vertical gradient `#F5F7F7 → #F2F7F7` (`--bg-page`), fixed-attachment. Tiles/popups are pure white. No imagery, textures, or hand-drawn illustration in the foundations.
- **Corner radii:** buttons 8px (m/s) / 6px (xs); cards & groups 16px; swatches ~9px; chips/pills 999px; menus 11px.
- **Borders:** 1px, light cool-grey-green (`--border-light` `#E1EDE7`, `--border-primary` `#B8CCCC`).
- **Shadows:** restrained. Dropdown menus `0 10px 30px rgba(40,50,55,.16)`; segmented-control active chip `0 1px 2px rgba(40,50,55,.10)`. No heavy elevation.
- **Animation:** subtle, functional. Button color transitions `.15s ease`; loader spinner `0.7s linear infinite` (slowed to 1.6s under `prefers-reduced-motion`). No bounces.
- **Hover / press:** accent button hover → `--primary-dark`; active → a paler primary tint (`--btn-pale`, mix of primary into white). Outline/transparent hover → faint primary wash via `color-mix`. Press lightens text + border to the pale tint rather than shrinking.
- **Focus:** `2px solid var(--primary)` outline, `2px` offset.
- **Transparency/blur:** transparency used for tints and status ramps via `color-mix`; no backdrop blur in the foundations.

## ICONOGRAPHY
- Icons in the Button documentation are **inline SVGs** drawn at 24×24 viewBox, `stroke="currentColor"` `stroke-width="2"` with round caps/joins (download, plus, chevron) — plus one filled glyph (star). They inherit the button's text color via `currentColor`.
- Icon sizing is token-driven per button size: 20px (m) / 18px (s) / 16px (xs); the chevron renders at 80% of the icon box.
- No icon font or sprite ships with this system, and there is no Unicode-as-icon or emoji usage. If a broader icon set is needed downstream, substitute a stroke-based CDN set (e.g. Lucide / Feather) to match the 2px round-cap style — flag any such substitution.

---

## Index / manifest
**Root**
- `styles.css` — global entry point (link this)
- `readme.md` — this file
- `SKILL.md` — Agent Skill manifest
- `Typography.html` — type specimen (card group: Type)
- `Colors.html` — color specimen (card group: Colors)
- `Buttons.html` — Button component docs + playground (card group: Components)

**styles/**
- `typography.css`, `colors.css`, `button.css`

**fonts/**
- SB Sans Display (Light/Regular/SemiBold), SB Sans Text (Regular/Semibold), SB Sans Screen

## Notes & caveats
- Components here are authored as **CSS + class names** (`.btn …`), not React. The Button has no `Button.jsx`/`.d.ts`, so it appears as a Design System card but is not bundled into the runtime component namespace. If you want a React `Button` primitive for the Starting Points picker, that can be added.
- No UI kits or slide templates were part of this import.
