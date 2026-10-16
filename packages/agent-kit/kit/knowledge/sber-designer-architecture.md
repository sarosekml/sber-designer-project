# sber-designer Architecture

Use this knowledge when an agent task depends on how sber-designer works rather
than on a single project convention.

## Product Model

sber-designer is a self-hostable visual UI builder. It connects to a frontend
repo, runs that repo in a sandbox iframe, inspects the live-DOM canvas, and
applies source edits through AST-aware tools.

The source of truth is always the connected project files and
`.sber-designer/*` project state. The canvas is a rendered view of that source,
not a vector document.

## Modes

sber-designer has three modes: Interact / Design / Code.

- **Interact:** the iframe behaves like the real app. The user clicks through
  screens and verifies behavior.
- **Design:** the same iframe becomes selectable. The editor inspects DOM/source
  targets, reports capabilities, and lets the agent patch selected elements.
- **Code:** the user reviews source and diffs. The same sandbox stays attached.

Mode switching must not recreate the iframe.

## Agent Boundaries

The built-in `ai-product-designer` can:

- read project index, built-in screen templates, catalog, design context,
  skills, and knowledge;
- create new screen implementation files and thin Storybook wrappers;
- register screens through `screen_create`;
- patch TSX/JSX through `apply_patch`;
- request re-indexing when context is stale.

The agent should not:

- bypass the project with standalone HTML/CSS;
- use a vector canvas as the document model;
- make direct provider SDK calls;
- edit shared components when the user asked for a screen instance;
- write outside project state, `.agents`, or approved workspace files.

## Context Layers

- `.agents/`: reusable agent prompts, skills, knowledge, and safe scripts.
- `.sber-designer/project.sdproj`: project screen, flow, comments, and session
  state.
- `.sber-designer/design-index/*`: generated and enriched project facts.
- Built-in screen templates: product-level recipes returned by
  `list_screen_templates`.
- Storybook/static catalog: component discovery and project-specific template
  stories when available.
- `DESIGN.md`: optional portable design brief and fallback source.

When context conflicts, prefer concrete source and design-index records over
generic knowledge.
