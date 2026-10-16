# @sber-designer/ast-bridge

`ts-morph` + Babel wrappers that bridge the DOM and the source AST.

- **Read direction.** Every JSX element rendered in the sandbox carries a
  `data-sd-loc="src/Foo.tsx:12:4"` attribute (injected by a Babel plugin
  installed into the sandbox dev-server). The DOM-overlay reads it on
  click; this package returns the corresponding ts-morph node.
- **Write direction.** Provides a small library of typed AST patches —
  `set-prop`, `remove-prop`, `set-style-prop`, `remove-style-prop`,
  `set-class-name`, `add-import`, `swap-component`, `wrap-with`,
  `set-children-text`, and `replace-text` — that Design mode and the chat
  agent use through `services/api`.

**Status:** active MVP primitive package — `applyOps` is real (ts-morph). See
[ADR-0013](../../docs/architecture/adr/0013-ast-bridge-primitives.md).

## Usage

```ts
import { applyOps } from '@sber-designer/ast-bridge';

await applyOps({
  workspaceRoot: '/abs/path/to/project',
  ops: [
    { kind: 'add-import', file: 'src/Page.tsx', source: '@/Tooltip', name: 'Tooltip' },
    {
      kind: 'set-prop',
      file: 'src/Page.tsx',
      loc: { line: 13, column: 5 },
      name: 'variant',
      value: '"ghost"',
    },
    { kind: 'remove-prop', file: 'src/Page.tsx', loc: { line: 13, column: 5 }, name: 'disabled' },
  ],
});
// → { ok: true, changedFiles: ['src/Page.tsx'], ops: [...] }
```

### Supported ops

| `kind`              | Use                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set-prop`          | Set/replace a JSX attribute. `value` is a TS expression as a string — string-literal patterns are detected, everything else is wrapped in `{...}`.                  |
| `remove-prop`       | Drop a JSX attribute.                                                                                                                                               |
| `set-style-prop`    | Set one React inline-style property, including CSS custom properties such as `--brand-color`. String CSS values must already be quoted.                             |
| `remove-style-prop` | Remove one React inline-style property.                                                                                                                             |
| `set-class-name`    | Replace a simple string-literal `className`. MVP refuses expression-based className rewrites.                                                                       |
| `add-import`        | Add a named (or `default: true`) import. Idempotent — attaches to an existing declaration if present.                                                               |
| `swap-component`    | Rename the JSX tag at `loc` (and its closing tag if present).                                                                                                       |
| `wrap-with`         | Wrap the JSX element at `loc` with `<wrapperName ...attrs>...</wrapperName>`. `wrapperAttrs` are raw JSX attribute strings.                                         |
| `set-children-text` | Replace all children of the JSX element at `loc` with one text node. Refuses on self-closing elements. Auto-escapes JSX-special characters via `{...}` when needed. |
| `replace-text`      | Replace exact source text that occurs once in a file. Used for generated-source block repairs when a structured JSX op is too narrow.                               |

JSX elements are addressed by 1-based `loc: { line, column }` matching
React Fiber's `_debugSource` (ADR-0007).

### Atomicity

Every op runs against an in-memory ts-morph `Project`. `project.save()`
is called only after the loop completes — if any op throws, nothing is
written.

### Safety

`safe-path.ts` rejects absolute paths and any relative path that
escapes `workspaceRoot`. The api boundary uses zod (`OpSchema`,
`ApplyPatchInputSchema`) before passing into ts-morph.

### Out of scope

- `extract-to-component` (requires scope analysis), `move-jsx`
  (drag-to-canvas insertion), and full style/class expression editing.
- Prettier / formatter step after save — re-apply yourself if your
  pipeline cares.
- Project-level shared `Project` cache for performance.
