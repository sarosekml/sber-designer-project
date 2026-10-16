import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

import { parseHowItWorksDocument, type HowItWorksMetadata } from '../src/lib/how-it-works-metadata';

export const HOW_IT_WORKS_CATALOG_ID = 'virtual:sber-designer/how-it-works-metadata';
const RESOLVED_CATALOG_ID = `\0${HOW_IT_WORKS_CATALOG_ID}`;
const DEFAULT_DOCUMENTATION_ROOT = fileURLToPath(
  new URL('../../../docs/how-it-works/', import.meta.url),
);

export function readHowItWorksCatalog(
  documentationRoot = DEFAULT_DOCUMENTATION_ROOT,
  today = new Date(),
): HowItWorksMetadata[] {
  return readdirSync(documentationRoot)
    .filter((fileName) => fileName.endsWith('.md'))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => {
      const source = readFileSync(resolve(documentationRoot, fileName), 'utf8');
      return parseHowItWorksDocument(source, fileName, today).metadata;
    });
}

export function howItWorksCatalogPlugin(documentationRoot = DEFAULT_DOCUMENTATION_ROOT): Plugin {
  return {
    name: 'sber-designer-how-it-works-catalog',
    configureServer(server) {
      server.watcher.add(documentationRoot);
    },
    resolveId(id) {
      return id === HOW_IT_WORKS_CATALOG_ID ? RESOLVED_CATALOG_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_CATALOG_ID) return null;
      const documents = readHowItWorksCatalog(documentationRoot);
      for (const document of documents) {
        this.addWatchFile(resolve(documentationRoot, document.fileName));
      }
      return `export default ${JSON.stringify(documents)};`;
    },
    handleHotUpdate(context) {
      if (
        !context.file.endsWith('.md') ||
        resolve(dirname(context.file)) !== resolve(documentationRoot)
      ) {
        return;
      }
      const catalogModule = context.server.moduleGraph.getModuleById(RESOLVED_CATALOG_ID);
      if (!catalogModule) return;
      context.server.moduleGraph.invalidateModule(catalogModule);
      return [catalogModule];
    },
  };
}
