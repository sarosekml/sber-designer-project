/**
 * @sber-designer/babel-plugin-sd-loc
 *
 * Tags every JSX opening element with a `data-sd-loc="file:line:col"`
 * attribute, where the value mirrors the format used by the editor's
 * DomOverlay. This is the Phase-1 fallback for ADR-0007's source
 * mapping — Webpack-based Storybook 6 doesn't reliably ship
 * `_debugSource`, and production builds tree-shake it. With this plugin
 * sber-designer's overlay can find the JSX node regardless.
 *
 * Behaviour:
 *   - JSXOpeningElement and JSXSelfClosingElement both supported.
 *   - Skips elements that already carry the attribute (idempotent — safe
 *     to combine with libraries that emit it themselves).
 *   - Path is workspace-relative. By default the plugin computes it as
 *     `path.relative(rootDir, filename)` with `rootDir = process.cwd()`.
 *     Override with the `rootDir` plugin option.
 *
 * Usage (Vite via @vitejs/plugin-react):
 *   ```ts
 *   import sdLoc from '@sber-designer/babel-plugin-sd-loc';
 *   plugins: [react({ babel: { plugins: [sdLoc] } })]
 *   ```
 *
 * Usage (Storybook 6 / Webpack):
 *   ```js
 *   // .storybook/main.js
 *   babel: async (cfg) => {
 *     cfg.plugins ??= [];
 *     cfg.plugins.push('@sber-designer/babel-plugin-sd-loc');
 *     return cfg;
 *   }
 *   ```
 *
 * Use the matching dev/production guard you'd use for any debug
 * instrumentation (only enable in development) — the plugin itself
 * doesn't read NODE_ENV.
 */
import type { PluginObj, PluginPass } from '@babel/core';
import type * as t from '@babel/types';
import { relative as relativePath } from 'node:path';

interface PluginOptions {
  /** Default: process.cwd(). */
  rootDir?: string;
  /** Default: 'data-sd-loc'. */
  attrName?: string;
}

interface PluginState extends PluginPass {
  opts: PluginOptions;
}

export default function babelPluginSdLoc(api: { types: typeof t }): PluginObj<PluginState> {
  const types = api.types;

  return {
    name: 'sd-loc',
    visitor: {
      JSXOpeningElement(path, state) {
        injectAttribute(path.node, state, types);
      },
    },
  };
}

function injectAttribute(node: t.JSXOpeningElement, state: PluginState, types: typeof t): void {
  if (!node.loc) return;

  const attrName = state.opts.attrName ?? 'data-sd-loc';
  const already = node.attributes.some(
    (attr) =>
      types.isJSXAttribute(attr) && types.isJSXIdentifier(attr.name) && attr.name.name === attrName,
  );
  if (already) return;

  const filename = state.filename ?? state.file?.opts.filename ?? 'unknown';
  const rootDir = state.opts.rootDir ?? process.cwd();
  const rel = filename === 'unknown' ? 'unknown' : relativePath(rootDir, filename);
  // 1-based line, 1-based column (Babel reports columns 0-based; we add 1
  // to align with React Fiber `_debugSource` and DomOverlay `parseLoc`).
  const value = `${rel}:${node.loc.start.line}:${node.loc.start.column + 1}`;

  node.attributes.push(
    types.jsxAttribute(types.jsxIdentifier(attrName), types.stringLiteral(value)),
  );
}
