import { expect, test } from 'bun:test';

import {
  buildHtmlDesignSystemApplyPrompt,
  buildHtmlDesignSystemDistillationPrompt,
  createHtmlDesignSystemApplyDraftDetail,
  createHtmlDesignSystemDistillationDraftDetail,
} from './html-design-system-distillation';

test('html design-system distillation prompt creates a reviewable proposal from existing pages', () => {
  const prompt = buildHtmlDesignSystemDistillationPrompt({
    pages: ['pages/deals.html', 'pages/request.html'],
  });

  expect(prompt).toContain('Create Design.md');
  expect(prompt).toContain('existing HTML pages');
  expect(prompt).toContain('pages/deals.html');
  expect(prompt).toContain('pages/request.html');
  expect(prompt).toContain('design/proposals');
  expect(prompt).toContain('extraction-report.md');
  expect(prompt).toContain('tokens.css');
  expect(prompt).toContain('components.css');
  expect(prompt).toContain('Do not edit production pages');
});

test('html design-system distillation draft can auto-send from Screens panel', () => {
  const detail = createHtmlDesignSystemDistillationDraftDetail({
    pages: ['pages/deals.html', 'pages/request.html'],
    autoSend: true,
  });

  expect(detail.autoSend).toBe(true);
  expect(detail.draft).toContain('pages/deals.html');
  expect(detail.draft).toContain('pages/request.html');
});

test('html design-system apply prompt targets existing pages with a structured directive', () => {
  const prompt = buildHtmlDesignSystemApplyPrompt({
    pages: ['pages/deals.html', 'pages/request.html'],
  });

  expect(prompt).toContain('[SBER_DESIGNER_HTML_DS_APPLY]');
  expect(prompt).toContain('targetPage=pages/deals.html');
  expect(prompt).toContain('targetPage=pages/request.html');
  expect(prompt).toContain('Apply the accepted HTML design system');
  expect(prompt).toContain(
    'replace inline/raw values with Design.md, tokens.css, and components.css',
  );
  expect(prompt).toContain('run static render validation');
  expect(prompt).not.toContain('design/proposals');
});

test('html design-system apply draft can auto-send after proposal accept', () => {
  const detail = createHtmlDesignSystemApplyDraftDetail({
    pages: ['pages/deals.html', 'pages/request.html'],
    autoSend: true,
  });

  expect(detail.autoSend).toBe(true);
  expect(detail.draft).toContain('[SBER_DESIGNER_HTML_DS_APPLY]');
  expect(detail.draft).toContain('pages/deals.html');
});

test('html design-system apply prompt requires explicit target pages', () => {
  expect(() => buildHtmlDesignSystemApplyPrompt({ pages: [] })).toThrow(
    'HTML design-system apply requires at least one target page.',
  );
});
