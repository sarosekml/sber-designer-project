import { defineConfig } from 'vite';

import { sdLocVitePlugin } from './tools/sd-loc-vite-plugin.ts';

export default defineConfig({
  plugins: [sdLocVitePlugin()],
});
