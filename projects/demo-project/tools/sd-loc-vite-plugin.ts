import { transformAsync, type PluginObj, type PluginPass } from '@babel/core';
import type * as BabelTypes from '@babel/types';
import type { Plugin as VitePlugin } from 'vite';

interface SdLocOptions {
  attrName?: string;
  rootDir?: string;
}

interface SdLocState extends PluginPass {
  opts: SdLocOptions;
}

export function sdLocVitePlugin(): VitePlugin {
  let rootDir = '';

  return {
    name: 'demo-sd-loc',
    enforce: 'pre',
    configResolved(config) {
      rootDir = config.root;
    },
    async transform(code, id) {
      const filename = id.split('?')[0] ?? id;
      if (!/\.[jt]sx$/.test(filename) || filename.includes('/node_modules/')) {
        return null;
      }

      const result = await transformAsync(code, {
        ast: false,
        babelrc: false,
        code: true,
        configFile: false,
        filename,
        parserOpts: {
          plugins: ['jsx', 'typescript'],
          sourceType: 'module',
        },
        plugins: [[sdLocBabelPlugin, { rootDir }]],
        sourceMaps: true,
      });

      if (!result?.code) return null;
      return {
        code: result.code,
        map: result.map ?? null,
      };
    },
  };
}

function sdLocBabelPlugin(api: { types: typeof BabelTypes }): PluginObj<SdLocState> {
  const types = api.types;

  return {
    name: 'demo-sd-loc-babel',
    visitor: {
      JSXOpeningElement(path, state) {
        injectAttribute(path.node, state, types);
      },
    },
  };
}

function injectAttribute(
  node: BabelTypes.JSXOpeningElement,
  state: SdLocState,
  types: typeof BabelTypes,
) {
  if (!node.loc) return;

  const attrName = state.opts.attrName ?? 'data-sd-loc';
  const already = node.attributes.some(
    (attr) =>
      types.isJSXAttribute(attr) &&
      types.isJSXIdentifier(attr.name) &&
      attr.name.name === attrName,
  );
  if (already) return;

  const filename = state.filename ?? state.file?.opts.filename ?? 'unknown';
  const rootDir = state.opts.rootDir ?? '';
  const value = `${toProjectRelativePath(filename, rootDir)}:${node.loc.start.line}:${
    node.loc.start.column + 1
  }`;
  const attribute = types.jsxAttribute(types.jsxIdentifier(attrName), types.stringLiteral(value));

  const firstSpreadIndex = node.attributes.findIndex((attr) => types.isJSXSpreadAttribute(attr));
  if (firstSpreadIndex === -1) {
    node.attributes.push(attribute);
  } else {
    node.attributes.splice(firstSpreadIndex, 0, attribute);
  }
}

function toProjectRelativePath(filename: string, rootDir: string) {
  const normalizedFile = stripQuery(filename).split('\\').join('/');
  const normalizedRoot = rootDir.split('\\').join('/').replace(/\/$/, '');

  if (normalizedRoot && normalizedFile.startsWith(`${normalizedRoot}/`)) {
    return normalizedFile.slice(normalizedRoot.length + 1);
  }

  for (const marker of ['/src/', '/.storybook/', '/tools/']) {
    const index = normalizedFile.indexOf(marker);
    if (index >= 0) return normalizedFile.slice(index + 1);
  }

  return normalizedFile;
}

function stripQuery(path: string) {
  return path.split('?')[0] ?? path;
}
