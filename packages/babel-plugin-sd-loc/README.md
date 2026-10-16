# @sber-designer/babel-plugin-sd-loc

Babel plugin that tags every JSX opening element with
`data-sd-loc="file:line:col"`, matching the format the editor's
`DomOverlay` falls back to when React Fiber `_debugSource` isn't
available.

This is the fallback path for [ADR-0007](../../docs/architecture/adr/0007-fiber-source-detection.md).

## When to use

You usually **don't need this** for a vanilla React + Vite project —
`@vitejs/plugin-react` already enables `@babel/plugin-transform-react-jsx-source`
in development, and the editor reads `_debugSource` through the React
Fiber walker. Reach for `babel-plugin-sd-loc` when:

- The target Storybook is on **Webpack 5** (Storybook 6 with
  `@storybook/react-webpack5`). `_debugSource` is not consistently
  emitted there.
- You want source mapping in **production builds** (Fiber `_debugSource`
  is tree-shaken out).
- The target stack is **not React** (Vue, Svelte). The plugin still
  emits the attribute; only the React-specific Fiber path doesn't apply.

## Install

The package is a workspace dep — no public publish. Hook it into your
target project locally; if the project lives outside the monorepo,
copy the `src/index.ts` into a private package or publish it under
your registry.

## Usage

### Vite (recommended)

```ts
import sdLoc from '@sber-designer/babel-plugin-sd-loc';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: process.env.NODE_ENV === 'development' ? [sdLoc] : [],
      },
    }),
  ],
});
```

### Storybook 6 / Webpack

```js
// .storybook/main.js
export default {
  babel: async (cfg) => {
    cfg.plugins = [...(cfg.plugins ?? []), '@sber-designer/babel-plugin-sd-loc'];
    return cfg;
  },
};
```

### Storybook 8 / Vite

Reach into `viteFinal` and modify the `@vitejs/plugin-react` instance,
or — easier — install our plugin **before** Storybook's react plugin
in the chain via the Vite `plugins` array. See the Vite snippet above.

## Options

```ts
sdLoc({ rootDir: process.cwd(), attrName: 'data-sd-loc' });
```

| Option     | Default         | Effect                                                               |
| ---------- | --------------- | -------------------------------------------------------------------- |
| `rootDir`  | `process.cwd()` | Anchor for the relative file path in the attribute value.            |
| `attrName` | `data-sd-loc`   | Attribute name to emit. Change only if your DOM has a name conflict. |

## What you get in the DOM

```html
<button data-sd-loc="src/components/Button.tsx:13:5">…</button>
<div data-sd-loc="src/pages/Demo.tsx:42:3">…</div>
```

The editor's overlay reads this attribute via
`closest('[data-sd-loc]')` whenever the React Fiber lookup returns
nothing, so source mapping degrades gracefully across all the cases
above.

## Idempotent

The plugin skips elements that already carry the attribute — safe to
re-apply or to combine with another tool that emits the same shape.
