# apply_patch Recipes

Use this sber-designer knowledge when changing existing TSX/JSX source. The
`apply_patch` tool accepts structured AST ops. It is safer than replacing whole
files for local edits because every op targets a source file plus JSX opening
element location.

## General Shape

```jsonc
{
  "tool": "apply_patch",
  "input": {
    "ops": [
      {
        "kind": "set-children-text",
        "file": "src/screens/Approvals.tsx",
        "loc": { "line": 42, "column": 9 },
        "text": "Approve payment",
      },
    ],
  },
}
```

Use `read_file`, Design mode inspection, or project-index screen records to
resolve the correct `file` and `loc`. Do not send `dom://` selectors to
`apply_patch`; resolve them to source first.

## set-children-text

Before:

```tsx
<Button>Approve</Button>
```

Op:

```jsonc
{
  "kind": "set-children-text",
  "file": "src/screens/Approvals.tsx",
  "loc": { "line": 42, "column": 9 },
  "text": "Approve payment",
}
```

After:

```tsx
<Button>Approve payment</Button>
```

## set-prop And remove-prop

String prop values must be quoted as TypeScript expressions.

```jsonc
{
  "kind": "set-prop",
  "file": "src/screens/Approvals.tsx",
  "loc": { "line": 42, "column": 9 },
  "name": "variant",
  "value": "\"primary\"",
}
```

```jsonc
{
  "kind": "remove-prop",
  "file": "src/screens/Approvals.tsx",
  "loc": { "line": 42, "column": 9 },
  "name": "disabled",
}
```

## set-style-prop And remove-style-prop

Use only for narrow inline style objects. Prefer tokens/classes when the project
uses them.

```jsonc
{
  "kind": "set-style-prop",
  "file": "src/screens/Approvals.tsx",
  "loc": { "line": 18, "column": 5 },
  "name": "gap",
  "value": "\"12px\"",
}
```

```jsonc
{
  "kind": "remove-style-prop",
  "file": "src/screens/Approvals.tsx",
  "loc": { "line": 18, "column": 5 },
  "name": "marginTop",
}
```

## set-class-name

Use for deterministic class strings. If the current className is expression
based, treat the target as assistant-only and make a careful source edit.

```jsonc
{
  "kind": "set-class-name",
  "file": "src/screens/Approvals.tsx",
  "loc": { "line": 18, "column": 5 },
  "value": "grid gap-4 rounded-md bg-surface-default p-4",
}
```

## add-import

Add imports before swapping or inserting component usage.

```jsonc
{
  "kind": "add-import",
  "file": "src/screens/Approvals.tsx",
  "source": "@/components/StatusBadge",
  "name": "StatusBadge",
}
```

## swap-component

Use when the selected JSX tag should become another already-imported component
or intrinsic element.

```jsonc
{
  "kind": "swap-component",
  "file": "src/screens/Approvals.tsx",
  "loc": { "line": 33, "column": 7 },
  "newName": "StatusBadge",
}
```

## wrap-with

Use as the current small-structure recipe instead of an unsupported
`insert-child` op.

```jsonc
{
  "kind": "wrap-with",
  "file": "src/screens/Approvals.tsx",
  "loc": { "line": 33, "column": 7 },
  "wrapperName": "Card",
  "wrapperAttrs": ["className=\"p-4\""],
}
```

For brand-new screens or large insertions, create the new file with
`write_file`, then use `screen_create` and `validate_design_screen`.
