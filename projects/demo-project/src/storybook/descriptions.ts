import type { ComponentDescriptionLayer } from "./description-layer";
export { describeComponent, describeStory } from "./description-layer";

export const typographyDescription: ComponentDescriptionLayer = {
  purpose:
    "Foundation type scale for finance-heavy investment CRM screens: display metrics, entity titles, section headings, dense body copy, captions, micro metadata, uppercase labels, and monospaced numbers.",
  anatomy: [
    "Inter 400/500/600",
    "JetBrains Mono for code-like finance values",
    "tabular numeric rhythm",
    "display/h1/h2/h3/body/body-s/caption/micro/eyebrow/mono styles",
  ],
  usage: [
    {
      title: "Display metric",
      when: "Use for hero KPIs and major financial totals.",
      props: { className: "t-display" },
    },
    {
      title: "Page and section hierarchy",
      when: "Use h1-h3 styles for entity names, page headers, and card headings.",
      props: { className: "t-h1 | t-h2 | t-h3" },
    },
    {
      title: "Dense product copy",
      when: "Use body, caption, and micro for analyst notes, triggers, source lines, and metadata.",
      props: { className: "t-body | t-caption | t-micro" },
    },
  ],
  agentGuidance: [
    "Reuse typography classes instead of inventing inline font sizes.",
    "Use display only for one or two dominant finance values per screen.",
    "Use t-mono for identifiers, currency strings, and tabular values that need scanning.",
  ],
  sourceHtml: "Design System.html#type",
};

export const colorDescription: ComponentDescriptionLayer = {
  purpose:
    "Foundation color system: cool neutral surfaces, emerald accent scale, semantic colors, text colors, surfaces, and borders.",
  anatomy: [
    "emerald accent scale",
    "cool gray neutral scale",
    "semantic success/danger/warning/info/violet/text",
    "surface and border tokens",
  ],
  usage: [
    {
      title: "Accent scale",
      when: "Use emerald accent tokens for primary actions, charts, focus rings, and positive financial direction.",
      props: { token: "--c-accent" },
    },
    {
      title: "Neutral scale",
      when: "Use cool gray tokens for backgrounds, cards, dividers, borders, and text hierarchy.",
      props: { token: "--c-bg | --c-surface | --c-border | --c-text" },
    },
    {
      title: "Semantic colors",
      when: "Use for status, validation, risk, AI, and informational feedback.",
      props: {
        token: "--c-success | --c-danger | --c-warning | --c-info | --c-violet",
      },
    },
  ],
  agentGuidance: [
    "Use CSS variables and semantic component props instead of hard-coded colors.",
    "Use emerald as the product accent, not as a one-note background palette.",
    "Keep neutral surfaces dominant in operational CRM screens.",
  ],
  sourceHtml: "Design System.html#color",
};

export const buttonDescription: ComponentDescriptionLayer = {
  purpose:
    "Action trigger for investment CRM workflows: add ideas, approve changes, export tables, open filters, and run AI analysis.",
  anatomy: [
    "variant",
    "size",
    "optional icon",
    "label",
    "loading or disabled state",
  ],
  usage: [
    {
      title: "Primary action",
      when: "Use once per panel or page for the main next step.",
      props: { variant: "primary", size: "md" },
    },
    {
      title: "Secondary action",
      when: "Use for neutral alternatives such as Export or Details.",
      props: { variant: "secondary" },
    },
    {
      title: "Danger action",
      when: "Use for destructive actions such as archive, delete, or block.",
      props: { variant: "danger | dangerOutline" },
    },
  ],
  agentGuidance: [
    "Do not create raw <button> styles when Button covers the state.",
    "Keep labels short and verb-led.",
    "Use icon-only buttons only for familiar controls and provide aria-label.",
  ],
  sourceHtml: "Design System.html#buttons",
};

export const buttonGroupDescription: ComponentDescriptionLayer = {
  purpose:
    "Compact connected button set for choosing one option from a small mutually exclusive group, such as day/week/month/year.",
  anatomy: [
    "inline group container",
    "equal-density buttons",
    "active item",
    "hover state",
  ],
  usage: [
    {
      title: "Time range",
      when: "Use when the user changes a period or small mode set without leaving the current view.",
      props: { active: "Day", items: "Day, Week, Month, Year" },
    },
  ],
  agentGuidance: [
    "Keep it intrinsic-width; do not stretch button groups across the page.",
    "Use ButtonGroup for small option sets, not for page navigation.",
    "Use short labels so the connected shape stays compact.",
  ],
  sourceHtml: "Design System.html#buttons",
};

export const segmentedControlDescription: ComponentDescriptionLayer = {
  purpose:
    "Low-emphasis segmented control for filtering or switching a local state inside a panel.",
  anatomy: ["soft container", "active segment surface", "2-4 short options"],
  usage: [
    {
      title: "List filter",
      when: "Use for compact filters such as All / Active / Archive.",
      props: { active: "All", items: "All, Active, Archive" },
    },
  ],
  agentGuidance: [
    "Keep segmented controls intrinsic-width and close to the content they filter.",
    "Do not replace page-level tabs with segmented controls.",
    "Use semantic labels, not generic Mode 1 / Mode 2 text.",
  ],
  sourceHtml: "Design System.html#buttons",
};

export const inputDescription: ComponentDescriptionLayer = {
  purpose:
    "Compact text entry controls used for asset names, search, e-mail fields, comments, validation states, and read-only finance values.",
  anatomy: [
    "label",
    "input or textarea",
    "leading/trailing affordance",
    "hint or error message",
  ],
  usage: [
    {
      title: "Text input",
      when: "Use in dialogs and editable detail forms.",
      props: { label: "Asset name", value: "Norilsk Nickel" },
    },
    {
      title: "Search field",
      when: "Use with a leading search icon for table and list filtering.",
      props: { leading: "search", placeholder: "Find asset, fund, or idea" },
    },
    {
      title: "Textarea",
      when: "Use for longer investment ideas, comments, and review notes.",
      props: { minHeight: "80px" },
    },
  ],
  agentGuidance: [
    "Use Field when a visible label or validation copy is needed.",
    "Use SearchField for list and table filtering.",
    "Use Textarea for free-form comments instead of stretching a single-line input.",
    "Avoid oversized inputs in dense analyst screens.",
  ],
  sourceHtml: "Design System.html#forms",
};

export const selectDescription: ComponentDescriptionLayer = {
  purpose:
    "Native select wrapped with the design-system chevron for compact categorical choices such as industry, owner, or status.",
  anatomy: [
    "Field label",
    "select-wrap",
    "select",
    "native options",
    "chevron affordance",
  ],
  usage: [
    {
      title: "Industry select",
      when: "Use when the option set is finite and mostly static.",
      props: { options: "Hotels, Metals, Pharma, Banks" },
    },
  ],
  agentGuidance: [
    "Use SelectControl inside Field for labeled dropdowns.",
    "Prefer segmented controls only for tiny visible option sets.",
    "Keep select labels business-specific; avoid placeholder-only selects.",
  ],
  sourceHtml: "Design System.html#forms",
};

export const checkboxDescription: ComponentDescriptionLayer = {
  purpose:
    "Checkbox option for multi-select access, filters, and boolean settings where several choices can be enabled together.",
  anatomy: [
    "hidden input",
    "custom box",
    "label text",
    "checked or unchecked state",
  ],
  usage: [
    {
      title: "Access roles",
      when: "Use when multiple roles or flags can be active at once.",
      props: { defaultChecked: "true" },
    },
  ],
  agentGuidance: [
    "Use Checkbox for independent yes/no items and multi-select groups.",
    "Keep checkbox labels short and explicit.",
    "Do not use checkboxes for mutually exclusive choices; use Radio instead.",
  ],
  sourceHtml: "Design System.html#forms",
};

export const radioDescription: ComponentDescriptionLayer = {
  purpose:
    "Radio option for mutually exclusive choices such as priority, risk level, or one selected mode.",
  anatomy: ["hidden radio input", "custom dot", "shared name", "label text"],
  usage: [
    {
      title: "Priority group",
      when: "Use when exactly one priority value should be selected.",
      props: { name: "priority", defaultChecked: "true" },
    },
  ],
  agentGuidance: [
    "Use the same name for every option in a radio group.",
    "Use Radio when choosing one value from a visible set of options.",
    "Do not use radio controls for free-form filtering; use segmented controls or select.",
  ],
  sourceHtml: "Design System.html#forms",
};

export const toggleDescription: ComponentDescriptionLayer = {
  purpose:
    "Switch-style boolean control for notification preferences and feature settings with immediate on/off meaning.",
  anatomy: ["hidden checkbox input", "track", "thumb", "label text"],
  usage: [
    {
      title: "Notification setting",
      when: "Use for persistent settings such as email digest or push notifications.",
      props: { defaultChecked: "true" },
    },
  ],
  agentGuidance: [
    "Use Toggle for settings, not for submitting forms.",
    "Pair toggles with direct labels that describe the enabled state.",
    "Avoid placing destructive actions behind toggles.",
  ],
  sourceHtml: "Design System.html#forms",
};

export const commandSearchDescription: ComponentDescriptionLayer = {
  purpose:
    "Compact topbar search box with leading search icon and keyboard shortcut hint for global platform search.",
  anatomy: [
    "search shell",
    "leading icon",
    "transparent input",
    "keyboard hint",
  ],
  usage: [
    {
      title: "Topbar search",
      when: "Use in app chrome or dense panels where global search is available.",
      props: { shortcut: "⌘K" },
    },
  ],
  agentGuidance: [
    "Use CommandSearch for global search; use SearchField for local table filtering.",
    "Keep the shortcut visible only when keyboard command exists.",
    "Do not put CommandSearch inside a standard form Field unless it needs a visible label.",
  ],
  sourceHtml: "Design System.html#forms",
};

export const badgeDescription: ComponentDescriptionLayer = {
  purpose:
    "Badge family for lifecycle status, industry tags, news priority pills, AI markers, and version chips.",
  anatomy: [
    "soft or solid badge",
    "optional status dot",
    "industry tag tone",
    "priority pill tone",
    "AI accent dot",
  ],
  usage: [
    {
      title: "Soft status badge",
      when: "Use Badge with dot for compact state labels such as Active, Paused, Closed, New, AI, and Draft.",
      props: {
        tone: "success | warning | danger | info | violet | neutral",
        dot: "true",
      },
    },
    {
      title: "Industry tag",
      when: "Use Tag in asset/fund tables to classify businesses.",
      props: {
        tone: "hotel | metal | pharma | bank | it | finance | soft | capital",
      },
    },
    {
      title: "News priority pill",
      when: "Use Pill for uppercase news/feed markers such as High Priority, Strategic, Growth, Regulatory, or Stakeholder.",
      props: { tone: "high | strategic | growth | warn | neutral" },
    },
    {
      title: "AI marker",
      when: "Use AI badge to mark generated recommendations and analysis.",
    },
  ],
  agentGuidance: [
    "Prefer semantic tones over hard-coded colors.",
    "Use solid badges for stronger event labels such as Updated, Urgent, or version chips.",
    "Use Tag for business categories; keep tags in the Badges catalog rather than creating a separate Tags component.",
    "Use Pill for news priority labels; use PriorityBadge only when the design needs the larger halo-dot priority marker.",
    "Use badges to add context, not as primary navigation.",
  ],
  sourceHtml: "Design System.html#badges",
};

export const priorityBadgeDescription: ComponentDescriptionLayer = {
  purpose:
    "Priority marker with a colored dot and soft halo for high, medium, and low priority states.",
  anatomy: ["inline label", "priority dot", "soft halo", "high/mid/low tone"],
  usage: [
    {
      title: "Priority label",
      when: "Use near ideas, tasks, and review queues where urgency must be visible without becoming a button.",
      props: { tone: "high | mid | low" },
    },
  ],
  agentGuidance: [
    "Use PriorityBadge for priority states instead of regular Badge when the source design shows a halo dot.",
    "Keep priority copy short; use full text only for the highest priority if needed.",
    "Do not use priority badges as clickable filters; use ButtonGroup or SegmentedControl for filtering.",
  ],
  sourceHtml: "Design System.html#badges",
};

export const avatarDescription: ComponentDescriptionLayer = {
  purpose:
    "Initial-based user avatars and compact avatar stacks for owners, analysts, and team members.",
  anatomy: ["size", "tone", "initials", "optional overlapping stack"],
  usage: [
    {
      title: "User avatar",
      when: "Use for owners and analysts in headers, lists, and tables.",
      props: {
        size: "xs | sm | md | lg | xl",
        tone: "emerald | violet | amber | blue | rose",
      },
    },
    {
      title: "Avatar stack",
      when: "Use overlapping avatars for grouped participants and add a neutral +N counter when hidden people remain.",
    },
  ],
  agentGuidance: [
    "Use Avatar for people and teams only; do not mix avatars into status badge stories.",
    "Use size md for tables and lg/xl for profile headers.",
    "Use a neutral avatar for +N overflow counters.",
  ],
  sourceHtml: "Design System.html#avatars",
};

export const tableDescription: ComponentDescriptionLayer = {
  purpose:
    "Reusable data table pattern for fund assets, portfolios, ideas, approvals, and other dense CRM datasets with selection, sorting, filters, tags, statuses, row actions, and pagination.",
  anatomy: [
    "table shell header",
    "selection summary",
    "segmented filters",
    "toolbar actions",
    "sortable column headers",
    "row selection checkboxes",
    "badge/tag/status cells",
    "row action menu",
    "pagination footer",
  ],
  usage: [
    {
      title: "Fund assets table",
      when: "Use for asset lists where the user scans names, acquisition year, investment amount, industry, and lifecycle status.",
      props: { component: "FundAssetsTable" },
    },
    {
      title: "Custom dataset",
      when: "Use DataTable with typed columns and rows when generating new screens with different table data.",
      props: { props: "rows, columns, filters, pagination, selectable" },
    },
  ],
  agentGuidance: [
    "Use DataTable instead of hand-coding a raw table when the screen needs sorting, filtering, selection, or pagination.",
    "Compose cells from existing design-system primitives such as Tag, Status, Badge, Button, and SegmentedControl.",
    "Keep numeric finance cells right-aligned with tabular numbers.",
    "Use the row action icon for secondary actions; do not place multiple full buttons inside every row.",
    "Keep filters in the table toolbar when they affect only this dataset.",
  ],
  sourceHtml: "Design System.html#table",
};

export const metaListDescription: ComponentDescriptionLayer = {
  purpose:
    "Compact metadata block for cards and detail headers: an icon, a short label, and a high-signal value arranged horizontally.",
  anatomy: [
    "icon container",
    "label",
    "value",
    "optional tabular numeric value",
    "responsive grid",
  ],
  usage: [
    {
      title: "Fund header facts",
      when: "Use for geography, investment volume, owner, e-mail, priority, or other short entity facts.",
      props: { component: "MetaList", columns: "2 | 3 | 4" },
    },
    {
      title: "Single information item",
      when: "Use MetaItem inside cards when only one icon-label-value fact is needed.",
      props: { component: "MetaItem" },
    },
  ],
  agentGuidance: [
    "Use MetaList instead of inventing ad-hoc icon + label + value layouts inside cards.",
    "Keep labels short and values single-line where possible.",
    "Use mono/tabular value styling for money, percentages, and other financial numbers.",
    "Do not use MetaList for long prose; use cards or body text for narrative content.",
  ],
  sourceHtml: "Design System.html#meta-list",
};

export const cardDescription: ComponentDescriptionLayer = {
  purpose:
    "Contained surface for KPIs, investment reports, change approvals, interaction history, and AI idea summaries.",
  anatomy: ["header", "body", "optional metric", "optional actions"],
  usage: [
    {
      title: "KPI card",
      when: "Use for one metric with delta and a short caption.",
    },
    {
      title: "Content card",
      when: "Use for lists, news, and analysis summaries.",
    },
  ],
  agentGuidance: [
    "Cards are repeated items or bounded panels, not page sections.",
    "Use CardTitle for consistent header density.",
    "Use KpiCard for dashboard metrics instead of custom numeric blocks.",
  ],
  sourceHtml: "Design System.html#cards",
};

export const chartDescription: ComponentDescriptionLayer = {
  purpose:
    "Small SVG chart primitives for investment CRM analytics cards: sparklines, line charts, bar charts, donut allocation, and heatmap risk blocks.",
  anatomy: [
    "typed data arrays",
    "token-driven chart tones",
    "SVG line and area paths",
    "bar and donut summaries",
    "compact legends",
  ],
  usage: [
    {
      title: "Card chart",
      when: "Use inside KPI, trend, dashboard, risk, allocation, and analysis cards.",
      props: {
        component: "LineChart | Sparkline | BarChart | DonutChart | Heatmap",
      },
    },
    {
      title: "Local analytics",
      when: "Use for static or local product data where adding a chart framework would add package and licensing overhead.",
    },
  ],
  agentGuidance: [
    "Use chart primitives before adding an external chart dependency.",
    "Keep chart colors bound to design tokens rather than hard-coded hex values.",
    "Use charts as compact card content; keep tables for exact financial values.",
  ],
  sourceHtml: "Design System.html#charts",
};

export const navigationDescription: ComponentDescriptionLayer = {
  purpose:
    "Navigation shell pattern for investment CRM screens: sidebar, page hierarchy, and top actions.",
  anatomy: [
    "sidebar groups",
    "current section",
    "content area",
    "secondary action area",
  ],
  usage: [
    {
      title: "Sidebar shell",
      when: "Use AppShell to create screens with global navigation and user context.",
    },
  ],
  agentGuidance: [
    "Prefer AppShell for full pages so screens keep the same CRM structure.",
    "Use the separate Breadcrumbs component at entity-detail depth.",
    "Use the separate Tabs component for entity sub-sections.",
    "Do not invent a second top-level navigation pattern inside a screen.",
  ],
  sourceHtml: "Design System.html#nav",
};

export const breadcrumbsDescription: ComponentDescriptionLayer = {
  purpose:
    "Breadcrumb trail for entity-detail and nested portfolio pages, showing the path from home to the current object.",
  anatomy: ["ordered path items", "slash separators", "current page label"],
  usage: [
    {
      title: "Fund detail path",
      when: "Use above a page header when the screen is nested under a portfolio or fund section.",
      props: { items: "Главная, Фонды, Гаражный кооператив «Фауна»" },
    },
  ],
  agentGuidance: [
    "Use Breadcrumbs at entity-detail depth, not on top-level dashboards.",
    "Keep earlier path items link-styled and the last item as the current page.",
    "Do not replace breadcrumbs with tabs or sidebar links.",
  ],
  sourceHtml: "Design System.html#nav",
};

export const tabsDescription: ComponentDescriptionLayer = {
  purpose:
    "Underline tab navigation for switching sections within the same entity or workspace without changing the global shell.",
  anatomy: [
    "tab row",
    "active underline",
    "optional count badge",
    "active content panel",
  ],
  usage: [
    {
      title: "Entity sections",
      when: "Use for fund, asset, or idea sub-sections such as overview, news, assets, interactions, ideas, and changes.",
      props: { active: "Общая информация", count: "1 | 2" },
    },
  ],
  agentGuidance: [
    "Use Tabs for peer sections inside one page; use sidebar navigation for top-level areas.",
    "Only add counters when they clarify pending or available items.",
    "Place the active tab content directly below the tab row.",
  ],
  sourceHtml: "Design System.html#nav",
};

export const baseScreenTemplateDescription: ComponentDescriptionLayer = {
  purpose:
    "Base page shell template for generated CRM screens: icon rail, section sidebar, breadcrumb row, search, notifications, user avatar, and a clearly bounded content work area.",
  anatomy: [
    "left icon rail",
    "section menu sidebar",
    "breadcrumb hierarchy",
    "topbar search and user actions",
    "content work area",
  ],
  usage: [
    {
      title: "New screen scaffold",
      when: "Use as the starting structure when the user asks the agent to create a new full page from existing Storybook components.",
      props: { template: "base-screen" },
    },
    {
      title: "Entity workspace",
      when: "Use when the screen needs persistent menu context plus breadcrumbs before the page-specific content.",
      props: { areas: "menu, breadcrumbs, search/avatar, content" },
    },
  ],
  agentGuidance: [
    "Keep the rail, sidebar, breadcrumb row, search, notification button, and avatar stable unless the user explicitly changes the shell.",
    "Place generated business UI only inside the content work area.",
    "Use Breadcrumbs, CommandSearch, Button, and Avatar from the design system rather than recreating these controls.",
    "Treat this as a template, not as a final screen: replace the dashed work area with the requested page content.",
  ],
  sourceHtml: "Design System.html#nav app shell sidebar",
};

export const patternDescription: ComponentDescriptionLayer = {
  purpose:
    "Reusable page-level patterns for Investment CRM screens: entity headers, scenario cards, progress steps, metric bars, timelines, feeds, and communication/search results.",
  anatomy: [
    "EntityHeader",
    "ChartPanel",
    "MetricBar",
    "Timeline",
    "TaskList",
    "NewsList",
    "DealList",
    "SearchResults",
    "ProgressSteps",
  ],
  usage: [
    {
      title: "Entity workspace composition",
      when: "Use EntityHeader with MetaList, badges, and page actions for fund, asset, deal, and idea detail screens.",
      props: { component: "EntityHeader" },
    },
    {
      title: "Operational insight cards",
      when: "Use ChartPanel, MetricBar, Timeline, ProgressSteps, and ScenarioPicker inside Card layouts for analytical side panels.",
      props: {
        component:
          "ChartPanel | MetricBar | Timeline | ProgressSteps | ScenarioPicker",
      },
    },
    {
      title: "Repeated business lists",
      when: "Use TaskList, NewsList, DealList, ChangeReviewList, CommunicationList, and SearchResults before hand-rolling repeated rows.",
      props: { component: "TaskList | NewsList | DealList | SearchResults" },
    },
  ],
  agentGuidance: [
    "Prefer these patterns when creating full pages; they are the same building blocks used by existing workspace screens.",
    "Compose patterns with primitive Button, Badge, Tag, Avatar, Card, MetaList, Tabs, and chart components.",
    "Only add raw markup for truly screen-specific layout wrappers or content that has no matching catalog pattern.",
    "Keep generated screens under src/screens/investment-crm/ with a thin Storybook wrapper under src/stories/screens/investment-crm/.",
  ],
  sourceHtml: "src/components/patterns.tsx",
};

export const screenPatternDescription: ComponentDescriptionLayer = {
  purpose:
    "Full-page screen examples for the Investment CRM workspace. Treat them as ordinary project screens, not as a protected design-system folder.",
  anatomy: [
    "AppShell",
    "PageHeader",
    "Tabs",
    "Card and KpiCard surfaces",
    "table, feed, or chart content",
    "right-rail insights",
  ],
  usage: [
    {
      title: "Workspace dashboard",
      when: "Use for the starting workspace with KPIs, portfolio health, and AI recommendations.",
    },
    {
      title: "Entity detail",
      when: "Use for fund, asset, deal, or idea pages with tabs, metadata, charts, and contextual actions.",
    },
  ],
  agentGuidance: [
    "Use these stories as realistic examples of project pages assembled from catalog components and patterns.",
    "For new screens, reuse Components/* and Templates/* first, then keep the generated implementation in src/screens/investment-crm/ and the Storybook file as a thin wrapper.",
    "Do not treat this folder as a protected design system; it is the editable project screen area for the presentation workspace.",
  ],
  sourceHtml: "src/screens/investment-crm/*.tsx",
};

export const pageLayoutDescription: ComponentDescriptionLayer = {
  purpose:
    "Layout-only building blocks for ordinary project screens: page stacks, card grids, split layouts, two-column insight pages, three-column business cards, and filter panels.",
  anatomy: [
    "PageStack",
    "PageBlock",
    "CardGrid",
    "ContentGrid",
    "SplitLayout",
    "TwoColumnLayout",
    "ThreeColumnGrid",
    "FilterPanel",
  ],
  usage: [
    {
      title: "Page composition",
      when: "Use PageStack and CardGrid instead of ad-hoc margin and grid styles in generated pages.",
      props: { component: "PageStack | CardGrid" },
    },
    {
      title: "Insight rail",
      when: "Use SplitLayout, ContentGrid, or TwoColumnLayout when a main work area needs a right-side context panel.",
      props: { component: "SplitLayout | ContentGrid | TwoColumnLayout" },
    },
    {
      title: "Business triplets",
      when: "Use ThreeColumnGrid for borrower, credit terms, risk profile, approval, or document triads.",
      props: { component: "ThreeColumnGrid" },
    },
  ],
  agentGuidance: [
    "Use these components before writing custom CSS grid or flex styles inside a page.",
    "Keep spacing declarative through the gap prop rather than inline margins.",
    "Pair FilterPanel with SearchField, SegmentedControl, and DataTable for list pages.",
  ],
  sourceHtml: "src/components/page-layouts.tsx",
};

export const businessCardDescription: ComponentDescriptionLayer = {
  purpose:
    "Business-level card components that package common Investment CRM content: thesis summaries, details, status lists, metrics, timelines, participants, feeds, search, contact lists, and dashboard editing helpers.",
  anatomy: [
    "ThesisCard",
    "DetailsCard",
    "MetricsCard",
    "StatusListCard",
    "TimelineCard",
    "NewsPanel",
    "TaskPanel",
    "DealPanel",
    "ChecklistPanel",
    "ParticipantsCard",
    "SearchHero",
  ],
  usage: [
    {
      title: "Deal detail cards",
      when: "Use DetailsCard, MetricsCard, and StatusListCard for borrower, credit terms, collateral, covenants, and approvals.",
      props: { component: "DetailsCard | MetricsCard | StatusListCard" },
    },
    {
      title: "Insight summaries",
      when: "Use ThesisCard and SummaryCard for AI ideas, analysis summaries, and review context.",
      props: { component: "ThesisCard | SummaryCard" },
    },
    {
      title: "Repeated side panels",
      when: "Use NewsPanel, TaskPanel, DealPanel, TimelineCard, RelatedEntitiesCard, and ContactListCard instead of rebuilding list rows in a page.",
      props: { component: "NewsPanel | TaskPanel | DealPanel | TimelineCard" },
    },
  ],
  agentGuidance: [
    "Prefer these cards before adding screen-specific card markup.",
    "Pass business content as props; do not duplicate internal list and card structure in pages.",
    "Use StatusListCard for large business blocks that combine icons, labels, values, and badges.",
    "When a generated page needs a repeated operational panel, add a reusable business card here first.",
  ],
  sourceHtml: "src/components/business-cards.tsx",
};

export const iconDescription: ComponentDescriptionLayer = {
  purpose:
    "Small inline SVG icons used by MetaItem, DetailsCard, and StatusListCard when the business meaning is not covered by the original meta-list icons.",
  anatomy: ["14px SVG", "currentColor stroke", "business semantic name"],
  usage: [
    {
      title: "Business facts",
      when: "Use inside MetaItem-compatible cards for borrower, term, collateral, document, covenant, and approval facts.",
      props: { component: "BuildingIcon | ShieldIcon | DocIcon | CheckIcon" },
    },
  ],
  agentGuidance: [
    "Use these project icons before defining new inline SVG inside a generated page.",
    "Keep icons decorative unless the surrounding component lacks a visible label.",
    "Add new icons here when a repeated business fact appears on multiple pages.",
  ],
  sourceHtml: "src/components/icons.tsx",
};
