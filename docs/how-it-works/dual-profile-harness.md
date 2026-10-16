---
updated: 2026-07-23T16:18:09+03:00
---

# Dual-profile harness

> **Status 2026-07-23:** implemented. The shared React/Storybook + HTML/CSS
> contract is covered by the parity contract below, the direct-provider
> baseline (2/2 profiles), and the real-project restructure/import smoke.
> Optional
> owner-triggered ultra/security commands remain release assurance, not an
> unfinished harness feature.

Этот документ связывает воедино мультиагентный harness sber-designer для двух
основных профилей подключенных проектов:

- React / Storybook / component-library projects.
- HTML-first / static HTML + CSS catalog projects.

Частные документы описывают отдельные подсистемы:
[Agent system](./agent-system.md), [Describe components for AI](./describe-components-for-ai.md),
[HTML-first projects](./html-first-projects.md), [Flow mode](./flow-mode.md),
[Code map](./code-map.md). Здесь — end-to-end карта: какие роли, skills, tools и
runtime-гарантии включаются вместе.

## Для кого / как читать

**Продакту**: читайте разделы "Профили", "Цикл описаний", "Авторинг и прототип".
Они объясняют пользовательский путь и почему Storybook больше не обязательный
центр системы.

**Разработчику**: читайте "Состав харнеса", "Рантаймы", "Где искать код" и "Как
расширить". Там перечислены файлы, границы ответственности и invariants, которые
важно не сломать.

**Ревьюеру**: проверяйте четыре правила:

- sidecar is canonical; surfaces are projections;
- source edits go through permission-gated tools;
- generated caches are rebuilt, not hand-authored;
- the product kit (`packages/agent-kit/kit`) and the root dev kit (`.agents/`) stay compatible with external agent apps.

## Профили

| Profile                     | Source surfaces                                                               | Component catalog                          | Description projection                             | Prototype behavior                             |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------- | ---------------------------------------------- |
| React + Storybook           | CSF stories, component sources, optional wrappers                             | Storybook index + static AST fallback      | Optional CSF docs projection                       | Flow edges drive Interact/Demo navigation      |
| React static / no Storybook | app/source files and generated screen wrappers                                | Static AST catalog and project index       | None by default                                    | Flow edges drive Interact/Demo navigation      |
| HTML-first / CSS catalog    | `design-system/{Design.md,tokens.css,components.css,refs/**}`, `pages/*.html` | CSS catalog from package sources and usage | Default managed `design-system/index.html` section | Real `<a href>` links plus mirrored flow edges |

Storybook changes what is visible by default, not what is canonical. HTML-first
changes the authoring surface and link model, not the agent contract.

## Состав харнеса

### Agents

| Agent                           | Role                                                                                    | Typical profile        | Key tools                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `ai-product-designer`           | Main screen/product agent. Builds and edits product screens with profile-aware context. | All                    | screen tools, index tools, validation, flow tools                                                         |
| `ai-screen-architect`           | Screen structure and prototype-oriented work.                                           | All                    | screen tools, flow tools, project index                                                                   |
| `ai-description-layer`          | Component-by-component Description for AI interview.                                    | All                    | `list_undescribed_components`, `get_usage_card`, `write_component_description`, `request_project_reindex` |
| `ai-component-author`           | Reusable component/code authoring.                                                      | Storybook/React mostly | source edit tools, Storybook component skill                                                              |
| `ai-design-system-scout`        | Design-system inspection and indexing support.                                          | All                    | index/search/read tools                                                                                   |
| `ai-project-restructurer`       | Plan-first conversion of a static repository into the canonical HTML-first layout.      | HTML-first             | `get_project_structure_report`, one permission-gated `apply_project_restructure` with receipt             |
| `ai-html-design-system-adapter` | Thin facade over an imported/custom static HTML/CSS/JS design system.                   | HTML-first             | index/read, scoped `apply_patch`, preview rebuild and one reindex                                         |

The exact tool list is filtered by agent-kit policy and runtime capability. The
important split is intent-based: description runs do not receive the full
screen-generation component pack, and screen-generation runs do not become
description interviews by accident.

### Skills

| Skill                             | When it activates                                                         | Profile           |
| --------------------------------- | ------------------------------------------------------------------------- | ----------------- |
| `component-description-interview` | User runs "Describe components" or selects `ai-description-layer`.        | All               |
| `storybook-component-work`        | Inspect, improve, duplicate, document, or create Storybook components.    | React + Storybook |
| `html-component-work`             | Inspect/add/update reusable CSS catalog components.                       | HTML-first        |
| `prototype-wiring`                | Wire existing screens into an executable prototype.                       | All               |
| `product-screen-generation`       | Generate or edit product screens using project index and templates.       | All               |
| `design-system-context`           | Read `DESIGN.md`, design-index records, descriptions, tokens, notes.      | All               |
| `project-restructure`             | Report, review and apply a canonical layout plan without silent deletion. | HTML-first        |
| `html-design-system-adapter`      | Preserve a foreign static DS and expose it through the canonical facade.  | HTML-first        |

Product skills live under `packages/agent-kit/kit/skills/*`. They are product
data, not instructions for the external coding agent editing this repository. Their
frontmatter remains Agent Skills compatible: `name`, `description`, optional
metadata, and ignorable `sd.profile` extensions.

### Knowledge

| Knowledge                | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `interactive-prototype`  | Flow/Demo conventions, real links for HTML-first, edge-reporting contract. |
| `project-index-anatomy`  | Shape of index files and how agents should consume them.                   |
| `catalog-response-shape` | Component/catalog response expectations.                                   |
| `design-mode-contract`   | What Design mode can safely inspect/apply.                                 |

Knowledge files are loaded by product agents through `read_agent_knowledge`.
They are kept role/capability-based: no customer-project component names or
fixed imports.

## Цикл описаний

One workflow covers both profiles:

```text
User starts "Describe components"
        |
        v
ai-description-layer + component-description-interview
        |
        v
list_undescribed_components -> get_usage_card -> sd:interview questions
        |
        v
User answers through controls -> sd:answer { componentId, answers, writeTarget }
        |
        v
write_component_description
        |
        +--> canonical sidecar
        |    .sber-designer/components/<componentId>.md
        |
        +--> optional projection
             Storybook CSF docs OR design-system/index.html section
        |
        v
request_project_reindex / external finalizer
        |
        v
components.jsonl + usage-cards.jsonl + description-map.json
        |
        v
screen generation receives prompt-ready component guidance
```

The source-of-truth rule is [ADR-0017](../architecture/adr/0017-description-source-of-truth.md):

- Canonical: `.sber-designer/components/<componentId>.md`.
- Projection: Storybook CSF docs or managed `design-system/index.html`.
- Derived cache: `components.jsonl`, `usage-cards.jsonl`, `description-map.json`.

When sidecar and projection disagree, sidecar wins. `get_component_description_source`
returns `canonical`, `indexed`, `projections[]`, and divergence diagnostics. DS
Browser shows a read-only view of the same provenance.

### Restore and rebuild

HTML-first `design-system/index.html` is generated. `rebuild_design_system_preview`
rewrites it from canonical package sources and reference-page metadata.

- `keepDescriptions: true` restores `Description for AI` sections from sidecars.
- `keepDescriptions: false` produces a clean preview; sidecars remain intact.
- Re-running restore/project projection can put sections back.

Storybook projections follow the same principle: projection writers update CSF
only when requested and round-trip verified. A failed projection falls back to
sidecar-only.

## Авторинг компонентов

### React / Storybook

Use `storybook-component-work` for reusable component work. The agent should:

- inspect the existing Storybook catalog and source;
- preserve project conventions;
- update stories only through normal edit-gated source tools;
- request reindex after component API or story changes.

Description work is separate. The description agent can read stories and usage
cards, but must persist through `write_component_description`.

### HTML-first

Use `html-component-work`. The canonical design-system sources are:

```text
design-system/Design.md
design-system/tokens.css
design-system/components.css
design-system/refs/**
```

`design-system/index.html` is a managed preview, not the source. The skill edits
package `components.css` and `tokens.css`, then rebuilds the preview and requests
reindex. Product pages are edited only when the task is page composition, not
while authoring reusable components.

An imported/custom HTML design system keeps its native manifests, specs,
catalog pages, templates, scripts, fonts and assets. The
`html-design-system-adapter` skill maps those entrypoints through local CSS
imports and `Design.md`; it does not flatten the bundle. The managed preview
resolves the local import graph, while the common design index normalizes the
result for the same role-based component selection used by Storybook projects.

HTML-first exposes an explicit **Screen / Design system** canvas switch. It is
also a harness scope signal:

- Screen view targets the active product page and reads the design-system
  package as context;
- Design system view uses the independent `__design-system__` chat session and
  targets only canonical sources, `refs/**`, `assets/**` and component sidecars;
- `screen_create` and flow mutations reject `design-system/**` paths;
- React projects without a Storybook preview keep the existing single Screen
  view, while React + Storybook keeps Screen / Storybook.

## Интерактивный прототип

Flow graph data lives in `.sber-designer/project.sdproj`, so prototype wiring is
project-owned state.

```text
React / Storybook:
  existing screen -> flow_add_edge(click/link/on-mount) -> Demo/Interact navigate

HTML-first:
  page anchor <a href="pages/target.html"> -> flow_add_edge(link href) -> Demo
  same link also works in plain static preview
```

Use `prototype-wiring` when the user asks to connect screens or make a
clickable scenario. It must identify existing screen ids first, avoid creating
new screens unless asked, and report changed pages plus edge ids/count.

## Рантаймы

### In-product API runtime

The built-in API loop owns full tool governance:

- zod schemas validate inputs;
- permission mapping classifies read/edit/run/send-pr actions;
- surface projections are edit-gated;
- receipts and run manifests record changed files and summaries;
- background index jobs update derived caches.

This path can write sidecars, Storybook projections, HTML projections, screen
files, and `.sdproj`, subject to permissions.

### External CLI handoff

External runtimes receive a role-aware handoff prompt and file/tool contracts.
For `ai-description-layer`, the handoff is sidecar-first:

- with proj-mcp/API bridge: use description tools and request reindex;
- without tools: write only `.sber-designer/components/<id>.md`;
- do not patch Storybook or `design-system/index.html` by hand;
- after exit, the API finalizer starts reindex when sidecar files changed.

This keeps CLI parity even when a specific external agent cannot call product
projection writers.

### proj-mcp

`packages/proj-mcp` exposes safe project tools to external agents. For
description work it mirrors the interview basics:

- `list_undescribed_components`;
- `write_component_description` sidecar write;
- `get_component_description_source` sidecar/index read-back;
- `request_project_reindex` through the API bridge.

Proj-mcp intentionally keeps projection writes product-owned. That is the safety
boundary: external agents can author canon; the app projects canon.

## Где искать код

| Area                       | Files                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Description tools          | `services/api/src/agent/tools/component-description.ts`, `services/api/src/component-description-source.ts`                                        |
| HTML projection writer     | `services/api/src/html-design-system-description-write.ts`, `services/api/src/html-design-system-preview.ts`                                       |
| Project reindex            | `services/api/src/agent/tools/project-index.ts`, `services/api/src/project-index/*`, `packages/design-indexer/src/builder.ts`                      |
| Usage cards                | `packages/design-indexer/src/usage-cards.ts`, `packages/design-indexer/src/description-map.ts`                                                     |
| Chat controls              | `apps/web/src/lib/interview-question.ts`, `apps/web/src/components/editor/chat/InterviewQuestions.tsx`                                             |
| Start interview            | `apps/web/src/lib/use-start-description-interview.ts`                                                                                              |
| DS Browser read-view       | `services/api/src/design-system-browser.ts`, `apps/web/src/lib/design-system-browser.ts`, `apps/web/src/components/editor/DesignSystemBrowser.tsx` |
| Flow runtime/tools         | `apps/web/src/lib/flow-runtime.ts`, `services/api/src/agent/tools/screens-flow.ts`                                                                 |
| External handoff/finalizer | `services/api/src/agent-runtimes/agent-kit-handoff.ts`, `services/api/src/routes/chat-stream/external-finalization.ts`                             |
| proj-mcp mirror            | `packages/proj-mcp/src/tools/component-description-core.ts`, `packages/proj-mcp/src/tools/index.ts`                                                |
| Agent kit                  | `packages/agent-kit/kit/agents/*`, `packages/agent-kit/kit/skills/*`, `packages/agent-kit/kit/knowledge/*`                                         |

The module-level map is [code-map.md](./code-map.md).

## Как расширить

### Добавить новый profile

1. Extend project-profile detection in the design indexer.
2. Define which project files are canonical source, projection, and derived
   cache.
3. Add role-aware context gates so screen generation and description runs do not
   receive each other's heavy context.
4. Add a profile-specific skill only if existing skills cannot express the
   workflow.
5. Keep kit frontmatter (product and root dev kit) Agent Skills compatible; put extensions under
   optional `sd.*`.

### Добавить description projection

1. Keep sidecar canonical.
2. Add a narrow server-side writer with path-safety and round-trip verification.
3. Gate it as `edit` in `agent-kit/permissions.ts`.
4. Add read-back to `component-description-source.ts` as a projection.
5. Add index gap-fill/divergence behavior only after sidecar precedence is
   covered by tests.

### Добавить tool

1. Implement the API tool in `services/api/src/agent/tools/*`.
2. Register it in `agent/toolset.ts`.
3. Classify permission/resource behavior in `agent-kit/permissions.ts`.
4. Mirror it in `proj-mcp` only when the external boundary is safe.
5. Document it in [connect-claude-code.md](../integrations/connect-claude-code.md)
   when external agents should call it.

## Acceptance smoke

Storybook project:

1. Run "Describe components" for 2-3 components.
2. Confirm default sidecar-only write and automatic coverage refresh.
3. Select Storybook projection for one component; verify Docs visibility.
4. Remove or change the projection; restore from sidecar.
5. Generate a screen that uses the authored fields.
6. Wire two screens; Demo navigates through flow edges.

HTML-first project:

1. Create or open an HTML-first project with `Design.md`, `tokens.css`,
   `components.css`, and pages.
2. Add or update a reusable CSS component through `html-component-work`.
3. Run "Describe components"; answer CSS catalog questions.
4. Verify sidecar plus managed `design-system/index.html` section.
5. Rebuild preview with and without keeping descriptions.
6. Check divergence read-back after manually changing a projection.
7. Generate a page that reuses the described class.
8. Wire pages with real `<a href>` links and mirrored flow edges.

These are owner-level live smoke checks. Automated gates are `bun run test`,
`bun run typecheck`, `bun run lint`, and the targeted regression tests that
carry these contracts in `tests/`.
