import {
  isHtmlDesignSystemPath,
  screenSurface,
  type ProjectScreen,
  type SberDesignerProject,
} from '@sber-designer/shared-types';

import { readWorkspaceFile, writeWorkspaceFile } from './safe-fs';

const INDEX_PATH = 'index.html';
const MANAGED_ATTR = 'data-sd-managed-screen-index';
const BLOCK_START = '<!-- sber-designer:screen-index:start -->';
const BLOCK_END = '<!-- sber-designer:screen-index:end -->';

export async function syncHtmlScreenIndex(project: SberDesignerProject): Promise<boolean> {
  if (project.projectKind !== 'html-first' || !project.workspacePath) return false;

  const nextBlock = renderManagedBlock(project);
  const existing = await readWorkspaceFile(project.workspacePath, INDEX_PATH).catch(() => null);
  const next = existing
    ? updateExistingIndex(existing, project, nextBlock)
    : buildHtmlScreenIndex(project);
  if (!next || next === existing) return false;
  await writeWorkspaceFile(project.workspacePath, INDEX_PATH, next);
  return true;
}

export function buildHtmlScreenIndex(project: SberDesignerProject): string {
  const title = titleCase(project.name);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} - Screens Index</title>
    <link rel="stylesheet" href="./design-system/tokens.css" />
    <link rel="stylesheet" href="./design-system/components.css" />
    <style>
      .screen-index-shell {
        box-sizing: border-box;
        min-height: 100vh;
        padding: clamp(32px, 5vw, 72px);
      }

      .screen-index-header {
        display: grid;
        gap: 12px;
        max-width: 880px;
        padding-bottom: 28px;
        border-bottom: 1px solid var(--color-border, #d1d5db);
      }

      .screen-index-eyebrow {
        margin: 0;
        color: var(--color-accent, #14532d);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .screen-index-title {
        margin: 0;
        color: var(--color-text, #111827);
        font-size: clamp(32px, 4vw, 52px);
        line-height: 1.05;
      }

      .screen-index-lead {
        margin: 0;
        color: var(--color-muted, #6b7280);
        font-size: 17px;
        line-height: 1.6;
      }

      .screen-index-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        margin-top: 32px;
      }

      .screen-index-card {
        display: grid;
        gap: 12px;
        min-height: 160px;
        padding: 20px;
        color: inherit;
        text-decoration: none;
        border: 1px solid var(--color-border, #d1d5db);
        border-radius: var(--radius-control, 8px);
        background: var(--color-bg, #ffffff);
      }

      .screen-index-card:hover {
        border-color: var(--color-accent, #14532d);
      }

      .screen-index-card h2 {
        margin: 0;
        color: var(--color-text, #111827);
        font-size: 20px;
        line-height: 1.25;
      }

      .screen-index-modal {
        display: inline-block;
        margin-left: 8px;
        padding: 2px 6px;
        border: 1px solid var(--color-border, #e5e7eb);
        border-radius: 999px;
        color: var(--color-muted, #6b7280);
        font-size: 11px;
        font-weight: 500;
        vertical-align: middle;
      }

      .screen-index-card p {
        margin: 0;
        color: var(--color-muted, #6b7280);
        line-height: 1.5;
      }

      .screen-index-path {
        align-self: end;
        color: var(--color-muted, #6b7280);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
      }

      .screen-index-empty {
        margin-top: 32px;
        max-width: 520px;
        padding: 20px;
        color: var(--color-muted, #6b7280);
        border: 1px dashed var(--color-border, #d1d5db);
        border-radius: var(--radius-control, 8px);
      }
    </style>
  </head>
  <body data-sd-screen-root ${MANAGED_ATTR}>
    <main class="screen-index-shell" aria-label="Screens Index">
      <header class="screen-index-header">
        <p class="screen-index-eyebrow">HTML-first project</p>
        <h1 class="screen-index-title">Screens Index</h1>
        <p class="screen-index-lead">${escapeHtml(title)} pages live in dedicated HTML files. Use this page as the project home and navigation index.</p>
      </header>
${renderManagedBlock(project)}
    </main>
  </body>
</html>
`;
}

function updateExistingIndex(
  existing: string,
  project: SberDesignerProject,
  nextBlock: string,
): string | null {
  const startIndex = existing.indexOf(BLOCK_START);
  const endIndex = existing.indexOf(BLOCK_END);
  if (startIndex >= 0 && endIndex > startIndex) {
    const before = existing.slice(0, startIndex);
    const after = existing.slice(endIndex + BLOCK_END.length);
    return `${before}${nextBlock}${after}`;
  }

  if (existing.includes(MANAGED_ATTR) || looksLikeLegacyHtmlFirstStarter(existing)) {
    return buildHtmlScreenIndex(project);
  }

  return null;
}

function renderManagedBlock(project: SberDesignerProject): string {
  return `      ${BLOCK_START}
${renderScreenList(project)}
      ${BLOCK_END}`;
}

function renderScreenList(project: SberDesignerProject): string {
  const screens = collectIndexedHtmlScreens(project.screens);
  if (!screens.length) {
    return `      <section class="screen-index-empty" aria-label="No screens yet">
        No project screens yet. Create a screen to add it to this index.
      </section>`;
  }

  const cards = screens
    .map(
      (screen) => `        <a class="screen-index-card" href="${escapeAttribute(
        `./${screen.path}`,
      )}" data-screen-id="${escapeAttribute(screen.id)}">
          <h2>${escapeHtml(screen.name)}${
            screen.isModal ? ' <span class="screen-index-modal">Modal</span>' : ''
          }</h2>
          <p>${escapeHtml(screen.description || 'Static HTML page.')}</p>
          <span class="screen-index-path">${escapeHtml(screen.path)}</span>
        </a>`,
    )
    .join('\n');
  return `      <section class="screen-index-grid" aria-label="Project screens">
${cards}
      </section>`;
}

function collectIndexedHtmlScreens(screens: ProjectScreen[]): Array<{
  id: string;
  name: string;
  path: string;
  isModal: boolean;
  description?: string;
}> {
  return screens
    .map((screen) => {
      const path = normalizePath(screen.implementationFilePath ?? screen.filePath);
      return { screen, path };
    })
    .filter((entry): entry is { screen: ProjectScreen; path: string } => {
      const path = entry.path;
      return (
        path !== null &&
        entry.screen.kind === 'page' &&
        path !== INDEX_PATH &&
        !isHtmlDesignSystemPath(path) &&
        path.toLowerCase().endsWith('.html')
      );
    })
    .map(({ screen, path }) => ({
      id: screen.id,
      name: screen.name,
      path,
      isModal: screenSurface(screen) === 'modal',
      ...(screen.description ? { description: screen.description } : {}),
    }));
}

function normalizePath(path: string | undefined): string | null {
  const normalized = path
    ?.replace(/\\/g, '/')
    .replace(/^\.?\//u, '')
    .trim();
  if (!normalized || normalized.startsWith('../') || normalized.startsWith('/')) return null;
  return normalized;
}

function looksLikeLegacyHtmlFirstStarter(source: string): boolean {
  return (
    source.includes('HTML-first project') &&
    source.includes('Create static pages, connect a design system')
  );
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
