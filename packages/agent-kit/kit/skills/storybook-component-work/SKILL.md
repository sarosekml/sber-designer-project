---
name: storybook-component-work
description: Inspect, improve, duplicate, document, or create reusable Storybook components in component mode.
compatibility: sber-designer
sd:
  profile:
    - react-storybook
---

# Storybook Component Work

Use this skill when the editor is in Storybook component mode or the user asks
to work on reusable components.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `catalog-response-shape`
- `project-index-anatomy`
- `frontend-ui-rules`
- `ui-anti-patterns`

## When to use vs when to defer

Use this skill when:

- The editor is in Storybook component mode and the active component is the
  requested scope.
- The user asks to inspect, improve, duplicate, document, or create reusable
  components or Storybook stories.
- Component description metadata or Storybook examples need to be improved for
  future agent context.

Defer to another skill when:

- The user asks to create a full product screen; use
  `product-screen-generation`.
- The user selected one element inside a screen canvas; use
  `visual-design-editing`.
- The task is only delivery through branch, commit, push, or PR.

Anti-examples:

- Do not use `screen_create`, `screen_remove`, or flow tools unless the user
  explicitly asks to manage Screens panel entries.
- Do not rewrite app pages while working on a reusable component story.

## Runbook

1. Treat the active component as the default scope.
2. Call `list_components` to confirm the component id, file path, stories, and
   available descriptions.
3. Read the component source and nearby stories before editing.
4. Check `.sber-designer/component-template.md` when creating a new component or
   documenting a component family.
5. Use `apply_patch` for focused component/story edits. Use `write_file` only
   for brand-new component or story files.
6. Add realistic Storybook examples for new variants and document product usage
   through descriptions or sidecars when the project uses them.
7. Avoid screen-specific tools unless the user explicitly asks to manage
   screens.

## Tool call examples

List catalog components and story ownership:

```jsonc
{ "tool": "list_components", "input": {} }
```

Read the active component source before editing:

```jsonc
{
  "tool": "read_file",
  "input": { "path": "src/components/DataTable.tsx" },
}
```

Patch one component prop or story example:

```jsonc
{
  "tool": "apply_patch",
  "input": {
    "ops": [
      {
        "kind": "set-prop",
        "file": "src/stories/DataTable.stories.tsx",
        "loc": { "line": 38, "column": 5 },
        "name": "density",
        "value": "\"compact\"",
      },
    ],
  },
}
```

Create a new story file only when it does not exist:

```jsonc
{
  "tool": "write_file",
  "input": {
    "path": "src/stories/NewComponent.stories.tsx",
    "contents": "import type { Meta, StoryObj } from '@storybook/react';\n",
  },
}
```
