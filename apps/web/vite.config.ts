import { defineConfig } from 'vite';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { howItWorksCatalogPlugin } from './vite/how-it-works-catalog';

export const BUILD_MARKER_META_NAME = 'sber-designer-build';

const BUILD_INFO_PATH = fileURLToPath(new URL('../../BUILD_INFO.json', import.meta.url));
const WEB_ROOT = fileURLToPath(new URL('.', import.meta.url));

export function readBuildGitSha(path = BUILD_INFO_PATH): string {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { gitSha?: unknown };
  if (typeof parsed.gitSha !== 'string' || !parsed.gitSha.trim()) {
    throw new Error(`${path}: gitSha must be a non-empty string`);
  }
  return parsed.gitSha.trim();
}

export function createBuildMarkerTag(gitSha: string): HtmlTagDescriptor {
  return {
    tag: 'meta',
    attrs: { name: BUILD_MARKER_META_NAME, content: gitSha },
    injectTo: 'head',
  };
}

export function resolveWebDevPort(value = process.env.VITE_PORT): number {
  const port = Number(value ?? 5173);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 5173;
}

export function resolveViteStartupProfile(input: {
  deploymentMode?: string | undefined;
  authMode?: string | undefined;
  oidcIssuer?: string | undefined;
}): { deploymentMode: 'local' | 'server'; authMode: 'local' | 'password' | 'oidc' } {
  const normalizedDeployment = input.deploymentMode?.trim().toLowerCase();
  if (
    normalizedDeployment &&
    normalizedDeployment !== 'local' &&
    normalizedDeployment !== 'server'
  ) {
    throw new Error(
      `SBER_DESIGNER_DEPLOYMENT_MODE must be local or server; received ${normalizedDeployment}`,
    );
  }
  const deploymentMode: 'local' | 'server' = normalizedDeployment === 'server' ? 'server' : 'local';
  const configuredAuth = input.authMode?.trim().toLowerCase();
  const authMode = configuredAuth || input.oidcIssuer?.trim() ? configuredAuth || 'oidc' : 'local';
  if (authMode !== 'local' && authMode !== 'password' && authMode !== 'oidc') {
    throw new Error(`Startup auth mode must be local, password, or oidc; received ${authMode}`);
  }
  if (deploymentMode === 'server' && authMode === 'local') {
    throw new Error('Server startup profile requires password or oidc authentication.');
  }
  return { deploymentMode, authMode };
}

function buildMarkerPlugin(gitSha: string): Plugin {
  return {
    name: 'sber-designer-build-marker',
    transformIndexHtml: () => [createBuildMarkerTag(gitSha)],
  };
}

// Phase 0 — simple Vite SPA. Backend is out of process (services/api).
// We deliberately do NOT use TanStack Start + Nitro (openpencil's choice)
// because it's overkill while the editor is still scaffolding.
export default defineConfig(() => {
  const gitSha = readBuildGitSha();
  // Vite executes this config through Node. Keep startup-profile resolution
  // self-contained: bare workspace imports are externalized and would expose
  // the source-only shared-types `.ts` export to Node's ESM loader.
  const startupProfile = resolveViteStartupProfile({
    deploymentMode: process.env.SBER_DESIGNER_DEPLOYMENT_MODE,
    authMode: process.env.SBER_DESIGNER_AUTH_MODE,
    oidcIssuer: process.env.SBER_DESIGNER_OIDC_ISSUER,
  });

  return {
    server: { port: resolveWebDevPort(), strictPort: true },
    plugins: [
      tsconfigPaths({ root: WEB_ROOT }),
      tailwindcss(),
      react(),
      howItWorksCatalogPlugin(),
      buildMarkerPlugin(gitSha),
    ],
    define: {
      'import.meta.env.VITE_SBER_DESIGNER_DEPLOYMENT_MODE': JSON.stringify(
        startupProfile.deploymentMode,
      ),
      'import.meta.env.VITE_SBER_DESIGNER_AUTH_MODE': JSON.stringify(startupProfile.authMode),
    },
  };
});
