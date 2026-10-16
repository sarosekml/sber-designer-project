---
name: component-description-interview
description: Run the component-by-component Description for AI interview — ranked queue, mined draft, profile-aware questions, confirm, write the canonical sidecar plus optional projection, recompile usage cards.
compatibility: sber-designer
---

# Component Description Interview

Use this skill when the user runs "Describe components" or switches to the
`ai-description-layer` agent. It turns mined facts into a human-confirmed
`Description for AI` layer. The canonical authored source is always the
sidecar; Storybook docs and `design-system/index.html` sections are recoverable
projections (task 0112).

## Load first

Call `read_agent_knowledge` for these ids when relevant before the runbook:

- `catalog-response-shape`
- `project-index-anatomy`
- `project-index-format`

## When to use vs when to defer

Use this skill when:

- The user wants to create or improve AI-facing component descriptions.
- The Project System reports low `describedComponents` coverage.

Defer when:

- The user wants to build a product screen (`product-screen-generation`).
- The user wants to edit a reusable component's code/stories
  (`storybook-component-work`).
- The task is delivery (branch/commit/PR).

Anti-examples:

- Do not hand-edit Storybook stories/CSF, app source, page HTML, or
  `design-system/index.html`. Persist through `write_component_description`; it writes
  the sidecar and, when requested, performs the safe tool-owned projection.
  In an external CLI runtime without tools, write **only** the sidecar and let
  the API finalizer/reindex restore derived caches.
- Do not author from a blank slate — always show the mined draft first.

## Runbook

1. Get the queue: `list_undescribed_components` (ranked by usage × missing
   description). Take the top N for this pass (default 5–10).
2. For the current component, call `get_usage_card` and present the mined draft:
   variant unions, required props, the canonical usage snippet, pairs-with.
3. Present the fixed question set for the current component **as a structured
   `sd:interview` block** (see "Interview controls" below) so the chat renders
   accept / own / skip controls. One short line of prose, then the block; each
   question carries a `suggestion` (your best mined/source answer). Then **end
   your turn and wait** for the reply. Keep it to the **core 5** per component;
   add an optional question only when it carries real signal, and never split
   into a question per variant value.
   - **Core 5 for React/Storybook:** Purpose (one sentence) · Use when (intent
     triggers) · Variants (what each value means — one question covering all
     values) · Required props (confirm/correct the mined list) · Keywords (2–3
     words).
   - **Core 5 for CSS catalog / html-first:** Purpose · Use when · Modifiers
     (what each modifier class means; map to `variantGuidance.prop = "modifier"`)
     · Base markup/classes (required classes go to `requiredProps`, canonical
     HTML goes to `canonicalSnippets`) · Keywords.
   - **Optional (only when it adds signal):** Use instead (only when a concrete
     adjacent component should be avoided → `whenNotToUse`) · Canonical usage
     (only when the mined snippet is non-obvious or wrong).
4. The user replies with an "Answers for <component>" block (accept = your
   suggestion, own = their text, `(skip)` = leave for later). When present, read
   the fenced `sd:answer` JSON block first: it is the authoritative compact
   payload `{ "componentId": "...", "answers": { ... }, "writeTarget": "..." }`.
   The legacy `Write target: sidecar|storybook|design-system|auto` line remains
   a fallback for runtimes that drop the fenced block. Apply the answers.
5. Persist with `write_component_description`. Pass `target` from the reply's
   `sd:answer.writeTarget` first, then from the fallback `Write target:` line; if
   absent, default `sidecar` unless the UI selected a profile projection. The
   user may also set the target by a free-text command ("write into Storybook",
   "write into the design system", "just the sidecar") — honor that, and let it
   stick for following components until they change it.
   - `sidecar` writes `.sber-designer/components/<id>.md` (human markdown + a
     machine block). This is the canonical source.
   - `storybook` additionally projects the description into the component CSF
     story (`docs.description.component`) with a safe AST-merge + round-trip
     gate, and **falls back to the sidecar** if it is not safe.
   - `design-system` additionally projects the description into
     `design-system/index.html` as a `<section data-sd-description-for="...">` with a
     round-trip gate, and **falls back to the sidecar** if it is not safe.
   - `auto` resolves server-side: Storybook/component-library projects project
     to Storybook; html-first/css-catalog projects project to `design-system/index.html`;
     otherwise it stays sidecar-only.
6. **Immediately advance — one save is not the end of the pass.** In the _same_
   reply, go back to step 2 for the **next** queued component and emit its
   `sd:interview` block. Do **not** stop, summarize, or report "described N, M
   remaining" after a single component. Keep looping (write → next block → wait)
   until **either** you reach the session budget (5–10 components) **or** the user
   sends a stop-phrase. Stopping after one component is a bug.
7. **Only at the end of the pass** (budget reached or stop-phrase) call
   `request_project_reindex` **once**. It starts a background job and returns a
   `jobId`/`statusEndpoint`; report those along with "described N, M remaining".
   Do not tell the user to click Index project manually.

## Opening message

Start the pass with one short message: what you'll do, how to answer (accept the
suggestion / type your own / skip per question), and how to stop — e.g. «когда
захотите остановиться, напишите “сохрани и закончим”». On such a phrase: write
everything confirmed so far, run one `request_project_reindex`, report the summary.

## Interview controls (UI protocol)

Present the current component's questions as a fenced block whose info-string is
`sd:interview` and whose body is JSON (shape below). The chat renders it as
accept / own / skip controls; answers return as a plain "Answers for …" reply,
and when a write target was selected the reply also contains an additive
`sd:answer` block. Prefer the `sd:answer` block over prose when parsing answers;
the prose is still visible to humans and remains a fallback.
Emit **one block per component** and end your turn to wait for that component's
answer; once it is applied and saved, emit the **next** component's block in your
reply (do not stop after one). Every question needs a `suggestion` (your best
mined/source answer — the "accept" default).

**`progress` — take it from the tool, do not guess.** `list_undescribed_components`
returns `progress: { index, total }` (index = already-described + 1, total =
describable components). Use those values verbatim and re-read them each component
so the counter advances; never reuse a stale `index` (the «always 2/8» bug). It is a
running position over the whole project, not a fixed pass size.

If you genuinely cannot emit valid JSON, the chat also parses a labelled prose
fallback: state the component `id:`, then `**Questions:**` with one
`**Label:** … *Suggestion: …*` line each. Prefer the JSON block — it is the
reliable path.

```jsonc
{
  "componentId": "atoms-badge",
  "componentName": "Badge",
  "progress": { "index": 1, "total": 8 },
  "questions": [
    {
      "id": "purpose",
      "label": "Purpose",
      "prompt": "What is it for?",
      "suggestion": "Status indicator for dictionary values.",
    },
    {
      "id": "use-when",
      "label": "Use when",
      "suggestion": "registry status cell; dictionary value",
    },
    {
      "id": "variants",
      "label": "Variants",
      "suggestion": "variant: outlined — secondary; filled — emphasis",
    },
    { "id": "required", "label": "Required props", "suggestion": "code, name" },
    { "id": "keywords", "label": "Keywords", "suggestion": "status chip, dictionary badge" },
  ],
}
```

Answer payload emitted by the UI when the user selected a target:

```jsonc
{
  "componentId": "atoms-badge",
  "answers": {
    "purpose": "Status indicator for dictionary values.",
    "use-when": "registry status cell; dictionary value",
    "variants": null,
  },
  "writeTarget": "storybook",
}
```

## Description for AI format

The confirmed layer is written as one block (human- and machine-readable):

```md
## Description for AI

**Purpose:** one sentence — what this component is for.
**Use when:** trigger a; trigger b
**Use instead:** `<OtherComponent>` for `<case>`.
**Variants:**

- `variant`: `outlined` — meaning; `filled` — meaning.
  **Required props:** `code`, `name`.
  **Canonical usage:**
  \`\`\`tsx
  <Component code={x} name={y} variant="outlined" />
  \`\`\`
  **Keywords:** status chip, dictionary badge, state indicator
```

## Working without sber-designer tools (CLI / external runtime)

Prefer MCP tool calls when the `mcp__sber-designer__*` tools are available:
`list_undescribed_components`, `get_usage_card`,
`write_component_description`, `get_component_description_source`, and
`request_project_reindex`. File conventions are fallback-only for CLI runs with
no MCP/tool bridge.

If you have no sber-designer or MCP tool calls, run the same flow with your own
file reads/writes:

- **Queue / draft (fallback instead of `list_undescribed_components` +
  `get_usage_card`):** read `.sber-designer/design-index/description-map.json`
  (per component: `status`, `keywords`),
  `.sber-designer/design-index/components.jsonl` (`id`, `shortName`, `source`,
  `confidence`, `requiredClasses`, `modifiers`, `canonicalHtml`) and
  `.sber-designer/design-index/usage-cards.jsonl` (`usageCount`,
  `variantGuidance`, `propsThatMatter`, `snippets`, `requiredClasses`,
  `modifiers`). Rank undescribed (`status` != `authored`) by `usageCount`; when
  `usageCount` is absent or tied, prefer `confidence` high > medium > low, then
  `componentId`. Read the component source/stories or CSS catalog evidence for
  accurate purpose and prop/class meanings.
  - **CSS catalog/html-first draft fields:** treat `requiredClasses` as the base
    class contract, `modifiers` as `variantGuidance.prop = "modifier"`, and
    `canonicalHtml` or the first catalog snippet as `canonicalSnippets`.
  - **Also check `.sber-designer/components/`** and treat any component that
    already has a `<id>.md` sidecar there as **described** — the index map can lag
    a reindex, so without this you will re-propose components done in a prior pass.
  - **Skip identity artifacts:** if a component `id` does not contain its real name
    (e.g. `id: atoms` for `SampleWidget`), skip it — describing it writes a
    garbage sidecar name.
  - **Progress:** `index` = (described + sidecars-on-disk) + 1, `total` = describable
    components; recompute each component so the counter advances.
- **Write (instead of `write_component_description`):** create
  `.sber-designer/components/<componentId>.md` with the `## Description for AI`
  markdown **and** a fenced ` ```sberDesigner ` block holding
  `{ "descriptionLayer": { …, "status": "confirmed" } }`. The indexer reads the
  structured block back and preserves the status. File fallback writes only the
  sidecar; do not hand-edit Storybook CSF or `design-system/index.html` projections.
  Those surfaces are updated only by tool-owned writers (`write_component_description`
  through product/MCP tooling, Restore, or rebuild flows).
- **Recompile:** external CLI runs cannot call product tools directly. After you
  write sidecars, prefer `request_project_reindex` when MCP is available. If no
  tools are available, finish normally; sber-designer's post-run finalizer
  detects `.sber-designer/components/*.md` changes and starts the same
  background reindex job. Mention that coverage may update after that job
  completes; do not edit `.sber-designer/design-index/*` by hand.
- The `sd:interview` controls render only in the in-product chat; in a terminal,
  ask the questions as plain text and write on confirmation.

## Tool call examples

Get the ranked queue:

```jsonc
{ "tool": "list_undescribed_components", "input": { "limit": 10 } }
```

Read the mined draft for the current component:

```jsonc
{ "tool": "get_usage_card", "input": { "componentId": "atoms-badge" } }
```

Persist a confirmed layer (sidecar + usage-card recompile):

```jsonc
{
  "tool": "write_component_description",
  "input": {
    "componentId": "atoms-badge",
    "layer": {
      "purpose": "Status indicator for dictionary values.",
      "whenToUse": ["registry status cell", "dictionary value"],
      "variantGuidance": [
        {
          "prop": "variant",
          "values": [
            { "value": "outlined", "meaning": "secondary chips" },
            { "value": "filled", "meaning": "emphasis" },
          ],
        },
      ],
      "requiredProps": ["code", "name"],
      "keywords": ["status chip", "dictionary badge", "state indicator"],
      "status": "confirmed",
    },
  },
}
```
