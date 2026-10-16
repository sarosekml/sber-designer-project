/**
 * Serve Monaco from the local bundle instead of the public jsdelivr CDN.
 *
 * `@monaco-editor/react`'s default loader fetches the editor from
 * `https://cdn.jsdelivr.net/npm/monaco-editor@<version>/min/vs` at runtime.
 * sber-designer is self-hostable / on-prem (CLAUDE.md rule #7): corporate
 * deployments routinely block, proxy, or simply run without access to public
 * CDNs. When that fetch never completes, Code mode is stuck on Monaco's
 * built-in "Loading..." fallback forever (the rest of the editor is unaffected
 * because the canvas iframe renders independently).
 *
 * Pointing the loader at the bundled `monaco-editor` package makes
 * `loader.init()` resolve from local assets and never touch the network, and
 * wires the language workers through Vite's `?worker` imports so IntelliSense
 * keeps working without a CDN.
 *
 * Imported for its side effects from `main.tsx` so the loader is configured
 * before any <Editor>/<DiffEditor> mounts.
 */
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new JsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker();
      case 'typescript':
      case 'javascript':
        return new TsWorker();
      default:
        return new EditorWorker();
    }
  },
};

// Use the bundled instance; do not load monaco from a remote CDN.
loader.config({ monaco });
