# @sber-designer/storybook-indexer

Builds the component catalog shown in the editor Components/Screens
surfaces and attached to agent context.

## Strategies

1. **Storybook indexer.** Fetches a running Storybook's `/index.json`,
   validates the Storybook 8 shape, skips `type === 'docs'` entries,
   groups stories by `title`, and builds iframe preview URLs.
2. **Static AST indexer.** When no Storybook preview is available,
   scans the workspace for React-looking exported components in
   `*.tsx` / `*.jsx` / `*.ts` / `*.js` files and creates virtual component
   entries.

**Status:** Storybook indexing and static AST fallback are implemented.
The catalog carries component id/title, short name, source file path,
story ids/preview URLs, and optional usage metadata from Storybook
description parameters or `.sber-designer/components/*.md` sidecars. Static
scan covers default functions/classes, default identifiers, `memo` /
`forwardRef`, named exported functions/classes/const arrow components, and
PascalCase export lists/re-export aliases.

```ts
import { indexFromStorybook, indexFromStaticAst } from '@sber-designer/storybook-indexer';

const storybookCatalog = await indexFromStorybook('http://localhost:6006', {
  workspaceRoot: '/abs/path/to/workspace',
});
const staticCatalog = await indexFromStaticAst('/abs/path/to/workspace');
```

## Description metadata

When `workspaceRoot` is provided, the Storybook indexer reads each CSF
file's `parameters` and extracts:

- `parameters.docs.description.component`
- `parameters.sberDesigner.descriptionLayer`
- `parameters.docs.description.story`
- `parameters.sberDesigner.storyDescription`

It also understands the local helper pattern used by the bundled demo:
`parameters: describeComponent(buttonDescription)`.

Both Storybook and static catalogs can fall back to markdown sidecars:

```text
.sber-designer/components/Button.md
.sber-designer/components/components-button.md
src/components/Button.sd.md
```

## Not in the catalog yet

- Args / argTypes / inferred prop metadata.
- Story screenshots.
