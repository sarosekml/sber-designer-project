# tokens/ — Tokens Studio source-of-truth

> Auto-generated from `src/styles/colors/*.ts`, `src/styles/theme/palette.ts`, `src/styles/theme/typography.ts`.
>
> **Do not edit by hand.** Regenerate via `node scripts/build-tokens.mjs` after changing the source code.

## Layout

| Path | Token set | Contents |
|---|---|---|
| `primitive/color.json` | `primitive/color` | All raw color shades from 20 palettes (`color.<palette>.<shade>`) — 265 leaves |
| `semantic/palette.json` | `semantic/palette` | All MUI/custom semantic colors from `theme/palette.ts` (`palette.<group>.<name>`) — 132 leaves, references `{color.x.y}` for non-alpha values, inlined hex8 for alpha |
| `semantic/typography.json` | `semantic/typography` | Font families (4), weights (2), sizes (11), line-heights (9) primitives + 29 typography composite variants (`typography.H1Light`, `typography.ButtonM`, etc.) |
| `component/button.json` | `component/button` | Button component tokens, nested under `atoms.button.*`. References `{palette.*}` for colors, `{typography.*}` for fonts. |
| `component/inputtext.json` | `component/inputtext` | InputText tokens, nested under `molecules.inputtext.*`. References `{palette.*}`, `{typography.BodyXSReg}`, `{font.size.*}`, `{font.lineHeight.*}`. |
| **`components.bundle.json`** | single-file | All component tokens grouped by atomic level: `atoms` / `molecules` / `organisms`. References resolve into base sets (palette/typography/color) which must be loaded alongside. |
| `$metadata.json` | — | `tokenSetOrder` for multi-file plugin import |
| `$themes.json` | — | empty (we don't ship themes yet) |

## How to import into Tokens Studio (Pixso plugin)

Two import flows, pick whichever the plugin version accepts:

### Flow A — multi-file (recommended)

1. **Tools → Load existing tokens → Folder** → select the whole `tokens/` directory.
2. Plugin reads `$metadata.json` and shows 5 sets in `tokenSetOrder`:
   - `primitive/color`
   - `semantic/palette`
   - `semantic/typography`
   - `component/button`
   - `component/inputtext`
3. Toggle all ON. Order in the sidebar matches `tokenSetOrder` and reflects dependency direction (base layers loaded first, components reference them).

### Flow B — file-by-file

Import each base file as a separate set, in this order:

1. `tokens/primitive/color.json`
2. `tokens/semantic/palette.json`
3. `tokens/semantic/typography.json`

Then for components, either:
- import the combined `tokens/components.bundle.json` (one file with `atoms.*`, `molecules.*`, `organisms.*`), **or**
- import each component file separately: `tokens/component/button.json`, `tokens/component/inputtext.json`, etc.

### After import

- Verify nothing is highlighted red (unresolved reference). If something is, the JSON probably wasn't fully loaded — re-open and reselect.
- Component tokens live under `atoms.*` / `molecules.*` / `organisms.*`. E.g. for the Button accent default background select `atoms.button.accent.default.bg` — the plugin will paint with `palette.Primary.Primary` → `color.emerald.500` → `#00AA9B`.

## Naming conventions

- **Casing:** code path = token path. `palette.Primary.Primary` in code → `palette/Primary/Primary` in JSON (slashes for nesting in Tokens Studio).
- **Primitives:** `color/<palette>/<shade>` (palette names: `swamp`, `emerald`, `cGrey`, `mGrey`, `lightBlue`, etc.; shades: `50/100/.../900` and `A100/A200/A400/A700`).
- **Semantic:** mirror exactly the keys in `theme/palette.ts` and `theme/typography.ts`.
- **Alpha colors:** stored as 8-digit hex (e.g. `#00AA9B0F`). The build script computes them from `alpha(palette[shade], factor)` calls in `palette.ts`.

## What is intentionally NOT here yet

- **Spacing / sizing / radius primitive sets** (`spacing.4`, `radius.8`, etc.) — for now `component/button.json` inlines literal px values like `"8"` / `"8 16 8 12"`. We'll extract the unique values into a primitive set when we add the second component (so we can deduplicate properly).
- **Box-shadow / elevation** — defer; comes with the first surface component (Card / Modal).
- **Other components** — only Button is wired so far. `IconButton`, `Inputs`, `Tabs`, `Tooltip`, `Tables` are next.

## Regenerating

```bash
node scripts/build-tokens.mjs
```

The script:
- parses `src/styles/colors/*.ts` to build primitives,
- parses `src/styles/theme/palette.ts` to build semantic palette (resolving `alpha(...)` to hex8),
- parses `src/styles/theme/typography.ts` to build typography variants,
- writes all six files atomically and prints a summary.

## Known mismatches between code and Pixso (open at the time of generation)

See [`typos-colors-code-mapping.md`](typos-colors-code-mapping.md) §3.4 — small hex deltas in `Info.Info`, `Link.LinkLight`, `Chart.CRed`, `Rate.RLightBlue`, `Product.PGrey`, `BG.BGMainMenu`. These tokens emit the **code** value (this generator's source of truth). When dropped into Pixso via Tokens Studio, the existing Pixso tokens will be overwritten on import.
