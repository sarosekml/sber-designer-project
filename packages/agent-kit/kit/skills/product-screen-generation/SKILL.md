---
name: product-screen-generation
description: Generate or edit app screens using built-in screen templates, design-index records, Storybook catalog components, and existing source files.
compatibility: sber-designer
sd:
  critique:
    policy: opt-in
  profile:
    - react-storybook
    - react
    - html-css
  craft:
    requires:
      - craft-anti-slop
      - craft-state-coverage
      - craft-layout-spacing
      - craft-data-density
---

# Product Screen Generation

Use this skill for new screens, generated screen fill-in work, and broad screen
composition edits. The output should work in the current app and move the
screen toward the Design-readable contract from 0015.

Universal rule: treat breadcrumb, page header, tile, card, table, filters,
actions, navigation, and form field as searchable roles. Exact component names,
ids, imports, tokens, icons, routes, assets, and examples must come from the
current connected project's index, catalog, description layer, agent notes, or
inspected source. Do not assume `ibp-ui-kit` or any other fixed component set
unless that is what the current project index exposes.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `sber-designer-architecture`
- `design-mode-contract`
- `project-index-anatomy`
- `screen-template-format`
- `catalog-response-shape`
- `apply-patch-recipes`
- `product-ui-patterns`
- `layout-recipes`
- `frontend-ui-rules`
- `ui-anti-patterns`

## When to use vs when to defer

Use this skill when:

- The user asks for a new page, screen, workflow, empty state, or dashboard.
- The active screen needs a broad composition pass across multiple sections.
- A legacy page must be repaired so future Design mode edits get deterministic
  `projectSupport`, `sourceScope`, and `capabilities`.

Defer to another skill when:

- The user asks for a selected-element tweak such as "rename this button" or
  "make this chip primary"; use `visual-design-editing`.
- The request needs a greybox first structure before final styling; use
  `screen-wireframe`.
- The screen already renders and only needs a final craft pass; use
  `screen-polish`.
- An existing screen needs broad recomposition or restyling while preserving its
  information architecture and facts; use `screen-redesign`.
- The user asks only which token or component to use; use design-system context.
- The request is only to prepare a branch, commit, or PR; use git workflow.

Anti-examples:

- Do not create a standalone HTML page when Catalog components can express the
  same screen.
- Do not rewrite a reusable component just to create one screen variant.
- Do not attempt to satisfy a very large BRD by emitting a giant one-shot
  `write_file` payload. A compact, working first screen is better than malformed
  JSON and no file.

## Large-screen protocol

Use this protocol for long attachments, BRDs, dashboard specs, or anything with
many sections:

1. Compress the requirement into a first-screen information architecture before
   editing: header, summary, 4-8 KPIs, the primary analytical block, a right
   rail, and one supporting lower block.
2. Use the active screen implementation file from editor state as the first
   write target. Only create a new implementation/story path when the task is
   explicitly to register a separate screen.
   For active empty screens, write the active implementation file first and do not call screen_create.
3. Rely on the project index for component choice. Read exact source files only
   when props are unclear, and use `read_file` with `limit`/`startLine`.
4. Keep the initial generated file small enough to be a reliable JSON tool
   argument. Prefer `write_file.contentsLines` for multiline files when it
   helps keep the JSON valid. If the screen needs more content, leave named
   arrays/sections that can be extended in a follow-up run after the first write
   validates.
5. If a `write_file` call fails because the JSON payload was malformed, do not
   repeat the same large payload. Retry once with a smaller implementation, then
   stop and report the blocker.
6. After full-file generation, use write_file or replace-text for structural repairs; do not use loc-based AST ops against freshly generated code unless a source-backed loc was read after the last write.
7. Validate with validate_design_screen before final response.

## Image-to-screen fidelity

When the task includes an image, screenshot, mockup, Pixso frame, or visual
reference, treat fidelity as a source requirement, not a mood hint.
The same content-fidelity rules apply to written briefs and specifications even
when no visual reference is attached.

1. Do a section-by-section pass before writing code: list the reference's top
   navigation/header, primary content blocks, side rails, tables/lists,
   supporting sections, and empty/error/loading states that are visible or
   implied.
2. Bind each section to real project roles from the index or component pack.
   Keep the hierarchy flat: avoid cards-inside-cards-inside-cards, decorative
   panel stacks, and anonymous wrapper layers when one page band, region, or
   project component expresses the same structure.
3. Preserve the first viewport. The hero or top work area must fit in a
   small laptop viewport with readable hierarchy, reachable primary actions,
   and a hint of the next section when the reference shows one.
4. Do not lazily under-generate. Every reference section is either implemented,
   intentionally compressed into a named region, or listed in the final response
   under omitted sections with a clear reason.
5. Match density and rhythm before embellishment. If the reference is a compact
   operational screen, build compact operational UI; if it is editorial, keep
   the spacious visual cadence without inventing unrelated marketing content.
6. Keep product UI copy in the language of the user brief or specification
   unless the user explicitly requests a translation. Do not anglicize a
   Russian brief or silently translate domain labels.
7. Preserve names, amounts, dates, identifiers, and status labels verbatim as
   key business facts from the source. If a fact is ambiguous, keep the original
   wording and flag the uncertainty instead of inventing a replacement.

## Runbook

1. Read editor state and identify whether this is an existing screen edit or a
   new screen.
   For ambiguous large briefs, image-led briefs, or under-specified product
   flows, route the structure through `screen-wireframe` first. For already
   working screens that need only refinement, route the finishing pass through
   `screen-polish`.
2. Call `get_project_index_status` to understand whether the unified project
   index is fresh. If it is stale or missing and component choice is risky, use
   `request_project_reindex` and wait for user approval before relying on broad
   guesses.
3. For existing screens, call `list_indexed_screens` or `search_project_index`
   to find the implementation path, Storybook wrapper, route, and
   Design-readable status before editing.
4. If this is a new-screen task, inspect screen templates with
   `list_screen_templates` (built-in plus project-local
   `.sber-designer/screen-templates/*.screen.md`, tagged by `source`). When a
   template is selected, follow its ASCII layout schema and regions in order and
   resolve each labelled role to a real project component; deviate only when a
   region genuinely does not fit, and say so. Use `read_screen_template` to pull
   a full template body on demand. If the user chose "Without template", infer
   structure from the instruction, index, catalog, and existing screens.
5. Use the Project index and Catalog entries to choose component families,
   tokens, icons, assets, and usage examples. Call `search_project_index` first,
   then `get_indexed_component`, `get_indexed_token`, `get_indexed_asset`, or
   `get_indexed_icon` for exact records. Use `list_components` with concrete
   queries when source inspection is still needed.
   Search by product role first, then bind to the exact component discovered in
   the current project.
6. Put editable page composition in the screen implementation file. When the
   project has a story split, keep a thin Storybook wrapper that only wires
   stories, args, decorators, providers, and sample data.
   Do not rename the screen on your own initiative. The screen display name,
   the component export, the Storybook `meta.title`, the story export, and the
   registered `storyId` are the user's identity for that screen — preserve all
   of them when filling or editing it, even when the new content suggests a
   nicer name. Do not rename the Storybook `meta.title` unless the user
   explicitly asks for a Storybook path rename. Never change the component export name without updating the
   story `import`/`component` in the same pass: a dangling import makes
   `component` undefined and the story fails to render with "the component
   annotation is missing from the default export". Only rename when the user
   explicitly asks; then load the `storybook-screen-rename` skill and keep the
   component, story `component`/`meta.title`, `storyId`, and screen
   registration consistent.
7. Build with documented props and tokenized class names. Avoid anonymous
   generated wrappers that make source mapping brittle.
8. For existing screens, edit narrowly with `apply_patch`. For new screens,
   create the implementation file first, then call `screen_create` only when the
   screen is not already registered.
   For active empty screens, write the active implementation file first and do
   not call screen_create.
9. Call `validate_design_screen` for generated or substantially repaired
   screens, then validate the result against the Design-readable screen
   checklist:
   - source can map to a screen implementation file;
   - no primary editable UI lives only in a Storybook wrapper;
   - important text and component props have obvious AST locations;
   - future Design mode can expose stable `projectSupport`, `sourceScope`, and
     `capabilities`.
10. After validation, the product runtime performs canvas render verification.
    If it reports a module, import, Storybook, Vite, or runtime error, preserve
    the generated source and repair the smallest failing import/usage before
    claiming completion.
11. If the connected project only supports baseline selection today, still make
    the requested edit. New or repaired surfaces should become Design-readable.

## Tool call examples

List screen templates before shaping a new screen, then pull the full body of
the chosen one (built-in or project):

```jsonc
{ "tool": "list_screen_templates", "input": {} }
```

```jsonc
{ "tool": "read_screen_template", "input": { "id": "deal", "source": "project" } }
```

Check indexed screen ownership before editing an existing page:

```jsonc
{
  "tool": "search_project_index",
  "input": { "query": "payment approvals", "types": ["screen"], "limit": 5 },
}
```

Search the Catalog by product intent, not by guessed import path:

```jsonc
{
  "tool": "list_components",
  "input": { "query": "approval table filters status badge" },
}
```

Inspect the selected component source before composing:

```jsonc
{
  "tool": "read_file",
  "input": { "path": "src/components/ApprovalsTable.tsx", "limit": 120 },
}
```

Register a new screen after the implementation file exists:

```jsonc
{
  "tool": "screen_create",
  "input": {
    "name": "Payment Approvals",
    "storyId": "screens-payments--payment-approvals",
    "filePath": "src/stories/screens/Ungrouped/PaymentApprovals.stories.tsx",
    "implementationFilePath": "src/screens/Ungrouped/PaymentApprovals.tsx",
    "folder": "Ungrouped",
    "description": "Approval queue for payment operations",
  },
}
```

Patch an existing screen implementation file rather than replacing the whole
screen:

```jsonc
{
  "tool": "apply_patch",
  "input": {
    "ops": [
      {
        "kind": "set-children-text",
        "file": "src/screens/PaymentApprovals.tsx",
        "loc": { "line": 42, "column": 9 },
        "text": "Approve payment",
      },
    ],
  },
}
```

Validate the screen before final handoff:

```jsonc
{
  "tool": "validate_design_screen",
  "input": { "screenId": "payment-approvals" },
}
```

## Output contract

Generated or substantially repaired screens should be Design-readable:

- visible product text is in stable JSX children or documented props;
- component imports come from the project component library where possible;
- do not shorten a component source path into a folder import unless that
  folder has an index export. If the catalog note says
  `src/components/atoms/Header/DashboardGroupHeader/DashboardGroupHeader.tsx`
  and existing project code imports from `@/components/atoms/Header`, use the
  working barrel import or the exact source module path;
- token-aware visual values are represented as reusable classes or token props;
- source mapping is obvious enough for Design mode to produce real
  capabilities instead of only `dom://` baseline selection;
- wrappers are structural, small, and named for their purpose.
