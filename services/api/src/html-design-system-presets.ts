import {
  DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID,
  HTML_DESIGN_SYSTEM_PRESETS,
  isHtmlDesignSystemPresetId,
  type HtmlDesignSystemPresetId,
} from '@sber-designer/shared-types';

export interface HtmlDesignSystemPresetBundle {
  id: HtmlDesignSystemPresetId;
  designMd: string;
  tokensCss: string;
  componentsCss: string;
}

export function resolveHtmlDesignSystemPresetId(value: unknown): HtmlDesignSystemPresetId | null {
  return isHtmlDesignSystemPresetId(value) ? value : null;
}

export function materializeHtmlDesignSystemPreset(
  id: HtmlDesignSystemPresetId = DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID,
  projectName = 'Project',
): HtmlDesignSystemPresetBundle {
  const title = titleCase(projectName);
  const preset = PRESET_CONTENT[id];
  return {
    id,
    designMd: `# ${title} Design System — ${preset.title}\n\n> Category: ${preset.category}\n\n${preset.designMd.trim()}\n`,
    tokensCss: `${preset.tokensCss.trim()}\n`,
    componentsCss: `${COMPONENTS_CSS.trim()}\n`,
  };
}

export function listHtmlDesignSystemPresetMetadata() {
  return HTML_DESIGN_SYSTEM_PRESETS;
}

interface PresetContent {
  title: string;
  category: string;
  designMd: string;
  tokensCss: string;
}

const PRESET_CONTENT: Record<HtmlDesignSystemPresetId, PresetContent> = {
  'dense-enterprise': {
    title: 'Dense Enterprise',
    category: 'Enterprise application',
    designMd: `## 1. Visual Theme & Atmosphere

- Build compact, dependable workspaces for frequent operational use.
- Prefer neutral surfaces, crisp boundaries, and one restrained teal accent.
- Information hierarchy comes from grouping, alignment, and weight rather than decoration.

## 2. Color Palette & Roles

- Use \`--color-bg\` for the application canvas and \`--color-surface\` for working panels.
- Use \`--color-text\` for primary information and \`--color-muted\` only for supporting metadata.
- Reserve \`--color-accent\` for primary actions, active navigation, and focus indication.
- Use semantic success, warning, and danger tokens only when the state carries that meaning.

## 3. Typography Rules

- Use the system sans stack through \`--font-sans\`; use \`--font-mono\` for identifiers and numeric codes.
- Default body size is 14px with a compact 1.45 line height.
- Page titles are 28–32px; section titles are 18–20px; table headers are 12px and semibold.
- Use tabular numerals for amounts, counts, dates, and percentages.

## 4. Component Stylings

- Controls use a 34px height, 6px radius, visible labels, and a clear focus ring.
- Cards are bordered surfaces with minimal shadow; nested cards are discouraged.
- Tables use compact rows, sticky headers when useful, and right-aligned numeric columns.
- Status badges pair text with color and never rely on color alone.

## 5. Layout Principles

- Use a 12-column page grid for complex screens and an 8px spacing rhythm.
- Keep primary actions close to the title or task they affect.
- Group filters in one compact toolbar and keep result counts visible.
- Preserve stable column alignment across loading, empty, error, and populated states.

## 6. Depth & Elevation

- Use borders for everyday grouping and \`--shadow-raised\` only for menus, dialogs, and floating controls.
- Avoid stacking more than two elevated layers.
- Active or selected states use accent border and tint before adding shadow.

## 7. Do's and Don'ts

- Do expose dense information with sorting, filtering, pagination, and explicit empty states.
- Do keep destructive actions visually separated and confirm irreversible operations.
- Don't use oversized hero areas, decorative gradients, glass effects, or excessive pill shapes.
- Don't hide essential actions behind hover-only affordances.

## 8. Responsive Behavior

- At narrow widths, preserve the primary task and move secondary metadata below it.
- Tables may scroll horizontally; never shrink columns until values become ambiguous.
- Toolbars wrap by functional group, while primary actions remain reachable without horizontal scroll.
- Page padding reduces from \`--space-page\` to 16px below 720px.

## 9. Agent Prompt Guide

Create a compact enterprise interface using the provided semantic tokens and reusable classes. Prioritize task completion, aligned data, explicit states, and predictable controls. Reuse existing table, card, field, button, and badge patterns before adding a new visual pattern. Keep decoration quiet and make every emphasis explainable by user priority or system state.`,
    tokensCss: `:root {
  color-scheme: light;
  --color-bg: #f4f6f8;
  --color-surface: #ffffff;
  --color-surface-muted: #eef1f4;
  --color-text: #172033;
  --color-muted: #5b6575;
  --color-border: #cbd2dc;
  --color-accent: #0f766e;
  --color-accent-hover: #115e59;
  --color-accent-soft: #ccfbf1;
  --color-success: #15803d;
  --color-warning: #b45309;
  --color-danger: #b91c1c;
  --space-page: 28px;
  --space-section: 20px;
  --space-control: 10px;
  --control-height: 34px;
  --radius-control: 6px;
  --radius-surface: 8px;
  --shadow-raised: 0 10px 24px rgb(23 32 51 / 12%);
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}`,
  },
  'calm-document': {
    title: 'Calm Document',
    category: 'Document workflow',
    designMd: `## 1. Visual Theme & Atmosphere

- Create a quiet reading environment with warm-neutral surfaces and deliberate whitespace.
- Let content lead; interface chrome should feel supportive and unobtrusive.
- Use subtle serif accents for editorial headings while controls remain in a clear sans serif.

## 2. Color Palette & Roles

- Use \`--color-bg\` for the warm page canvas and \`--color-surface\` for documents and dialogs.
- Use \`--color-text\` for readable long-form copy and \`--color-muted\` for annotations and provenance.
- Reserve \`--color-accent\` for links, focus, and the single primary action in a view.
- Use tinted semantic backgrounds sparingly for review or approval status.

## 3. Typography Rules

- Body copy uses \`--font-sans\` at 16px with a 1.65 line height.
- Document and page headings may use \`--font-display\`; never use it for form controls or dense metadata.
- Keep prose lines between 60 and 78 characters where practical.
- Use a visible type scale: 34–40px page title, 24–28px section title, 16px body, 13px metadata.

## 4. Component Stylings

- Document surfaces use 12px corners, generous internal padding, and a quiet border.
- Controls use a 40px height with persistent labels and comfortable click targets.
- Buttons use sentence case; only one filled primary button appears in a local action group.
- Notes and quotations use a left rule or soft tint, not heavy containers.

## 5. Layout Principles

- Center the primary reading column and cap it at 760px; tools may occupy a separate side rail.
- Use a 12px spacing rhythm and separate sections with whitespace before separators.
- Keep author, date, state, and document actions close to the title.
- Avoid multi-column prose unless the content is explicitly comparative.

## 6. Depth & Elevation

- Prefer flat layering with border contrast between canvas and document surface.
- Use \`--shadow-raised\` for dialogs and transient menus only.
- Sticky toolbars may use a subtle shadow after scrolling to clarify separation.

## 7. Do's and Don'ts

- Do preserve readable line length, visible focus, and clear save or review state.
- Do show document history and provenance without interrupting the reading flow.
- Don't compress long-form copy into dashboard cards or surround every section with a border.
- Don't use saturated backgrounds, decorative gradients, or unnecessary all-caps labels.

## 8. Responsive Behavior

- Collapse side tools below the document or into a labelled drawer under 900px.
- Reduce page padding gradually while preserving at least 18px around the reading surface.
- Keep the document action bar reachable and allow secondary actions to wrap.
- Never reduce body copy below 15px.

## 9. Agent Prompt Guide

Create a calm document-centered interface using the provided semantic tokens and content hierarchy. Protect reading width, whitespace, provenance, and clear review states. Reuse document surface, note, field, button, and metadata patterns before introducing new containers. Use emphasis sparingly so the primary document and its next action remain obvious.`,
    tokensCss: `:root {
  color-scheme: light;
  --color-bg: #f5f2eb;
  --color-surface: #fffdf9;
  --color-surface-muted: #eee9df;
  --color-text: #2d2a26;
  --color-muted: #746d63;
  --color-border: #d9d1c4;
  --color-accent: #765b36;
  --color-accent-hover: #5f482b;
  --color-accent-soft: #eee2cf;
  --color-success: #397354;
  --color-warning: #9a681e;
  --color-danger: #a6423a;
  --space-page: 56px;
  --space-section: 32px;
  --space-control: 12px;
  --control-height: 40px;
  --radius-control: 9px;
  --radius-surface: 12px;
  --shadow-raised: 0 16px 40px rgb(65 54 40 / 12%);
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-display: Georgia, "Times New Roman", serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}`,
  },
  'dashboard-first': {
    title: 'Dashboard First',
    category: 'Analytics dashboard',
    designMd: `## 1. Visual Theme & Atmosphere

- Build a crisp analytical workspace with a clear metric hierarchy and modular regions.
- Use cool neutral surfaces, blue interaction color, and semantic status accents.
- Keep charts and metrics prominent while controls remain compact and predictable.

## 2. Color Palette & Roles

- Use \`--color-bg\` for the dashboard canvas and \`--color-surface\` for metric and chart panels.
- Use \`--color-text\` for labels and values; \`--color-muted\` supports comparison periods and units.
- Use \`--color-accent\` for interaction and selection, not as the default chart series color.
- Semantic colors indicate outcome; chart series must remain distinguishable without relying on red versus green alone.

## 3. Typography Rules

- Use \`--font-sans\` throughout and \`--font-mono\` only for technical identifiers.
- Metric values use 28–36px semibold text with tabular numerals.
- Panel titles use 15–17px semibold text; labels and legends use 12–13px.
- Keep units adjacent to values and make comparison periods explicit.

## 4. Component Stylings

- Metric cards use a stable label, primary value, comparison, and optional compact visualization.
- Chart cards share header, legend, loading, empty, and error structures.
- Filters use a compact toolbar and expose active filter count or removable values.
- Buttons and fields use a 38px height, 8px radius, and a visible focus ring.

## 5. Layout Principles

- Use a 12-column grid; align related metrics and charts to shared column edges.
- Place summary metrics first, diagnostic charts second, and detailed tables last.
- Keep filter scope visible and avoid controls that silently affect unrelated panels.
- Use consistent panel padding and avoid mixing unrelated densities in one row.

## 6. Depth & Elevation

- Panels use border and surface contrast; avoid shadow on every card.
- Use \`--shadow-raised\` only for menus, dialogs, and draggable overlays.
- Selected panels or drill-down targets use accent border and tint rather than increased elevation.

## 7. Do's and Don'ts

- Do provide loading, no-data, stale-data, partial-data, and error states for analytical panels.
- Do label axes, units, time ranges, and comparison baselines.
- Don't add decorative charts, unlabeled icons, or color-only legends.
- Don't place every metric in an equally prominent card; preserve a clear reading order.

## 8. Responsive Behavior

- Collapse the 12-column grid to six and then one column while preserving metric order.
- Allow charts to keep a useful minimum height and move legends below when width is constrained.
- Filter toolbars wrap by group; active scope remains visible above results.
- Detailed tables may scroll horizontally after high-priority columns are pinned.

## 9. Agent Prompt Guide

Create an analytical dashboard using the provided semantic tokens and a clear summary-to-detail hierarchy. Reuse metric, chart, filter, table, badge, and state patterns before introducing new structures. Label every measure, comparison, and time scope. Keep status color semantic, preserve accessible contrast, and design loading, empty, stale, partial, and error states with the populated layout.`,
    tokensCss: `:root {
  color-scheme: light;
  --color-bg: #f1f5f9;
  --color-surface: #ffffff;
  --color-surface-muted: #e8eef6;
  --color-text: #172033;
  --color-muted: #64748b;
  --color-border: #cbd5e1;
  --color-accent: #2563eb;
  --color-accent-hover: #1d4ed8;
  --color-accent-soft: #dbeafe;
  --color-success: #15803d;
  --color-warning: #c27510;
  --color-danger: #c24141;
  --color-chart-1: #2563eb;
  --color-chart-2: #7c3aed;
  --color-chart-3: #0891b2;
  --color-chart-4: #ca8a04;
  --space-page: 32px;
  --space-section: 24px;
  --space-control: 10px;
  --control-height: 38px;
  --radius-control: 8px;
  --radius-surface: 10px;
  --shadow-raised: 0 14px 32px rgb(30 41 59 / 14%);
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}`,
  },
};

const COMPONENTS_CSS = `*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
}

button,
input,
select,
textarea {
  font: inherit;
}

.page-shell {
  min-height: 100vh;
  padding: var(--space-page);
}

.surface,
.card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-surface);
  background: var(--color-surface);
}

.button {
  display: inline-flex;
  min-height: var(--control-height);
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-control);
  background: var(--color-accent);
  color: #ffffff;
  font-weight: 600;
  text-decoration: none;
}

.button:hover {
  border-color: var(--color-accent-hover);
  background: var(--color-accent-hover);
}

.button:focus-visible,
.field:focus-visible {
  outline: 3px solid var(--color-accent-soft);
  outline-offset: 2px;
}

.field {
  min-height: var(--control-height);
  padding: 0 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
}

.badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--color-accent-soft);
  color: var(--color-text);
  font-size: 12px;
  font-weight: 600;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.data-table th,
.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

.data-table th {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 600;
}

.numeric {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 720px) {
  .page-shell {
    padding: 16px;
  }
}`;

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
