/**
 * 0132.4 — the HTML Screens Index marks modal screens with a badge.
 */
import { expect, test } from 'bun:test';

import { buildHtmlScreenIndex } from '../services/api/src/html-screen-index';
import type { SberDesignerProject } from '@sber-designer/shared-types';

function project(): SberDesignerProject {
  return {
    version: 1,
    name: 'HTML project',
    workspacePath: '/workspace',
    projectKind: 'html-first',
    screens: [
      { id: 'list', name: 'Deals', kind: 'page', filePath: 'pages/deals.html' },
      {
        id: 'confirm',
        name: 'Delete confirm',
        kind: 'page',
        surface: 'modal',
        filePath: 'pages/delete-confirm.html',
      },
    ],
    flow: [],
  };
}

test('the Screens Index badges a modal card but not a page card', () => {
  const html = buildHtmlScreenIndex(project());
  // The modal card carries the badge next to its title.
  expect(html).toContain('Delete confirm <span class="screen-index-modal">Modal</span>');
  // The page card does not.
  expect(html).toContain('<h2>Deals</h2>');
  expect(html).not.toContain('Deals <span class="screen-index-modal">');
});
