import { expect, test } from 'bun:test';

import {
  buildHtmlDesignSystemReferencePrompt,
  createHtmlDesignSystemReferenceProposalId,
  createHtmlDesignSystemReferenceDraftDetail,
} from './html-design-system-reference';

test('html design-system reference prompt asks for Design.md proposal from image or Pixso', () => {
  const prompt = buildHtmlDesignSystemReferencePrompt();

  expect(prompt).toContain('Write Design.md');
  expect(prompt).toContain('attached screenshot');
  expect(prompt).toContain('Pixso link');
  expect(prompt).toContain('design/proposals');
  expect(prompt).toContain('Load the ai-design-system-scout skill');
  expect(prompt).toContain('activation-safe, complete replacement');
  expect(prompt).toContain('otherwise omit it');
  expect(prompt).toContain('extraction-report.md');
  expect(prompt).toContain('9-section project style contract');
  expect(prompt).toContain('low-confidence');
  expect(prompt).toContain('design-system.html');
  expect(prompt).toContain('static preview/catalog');
  expect(prompt).toContain('Do not create or edit a screen implementation');
});

test('html design-system reference prompt follows wizard preview option', () => {
  const withPreview = buildHtmlDesignSystemReferencePrompt({
    sourceKind: 'pixso',
    pixsoUrl: 'https://pixso.example/file/abc',
    notes: 'Focus on dashboard tokens.',
    includeDesignSystemPreview: true,
  });
  const docsOnly = buildHtmlDesignSystemReferencePrompt({
    sourceKind: 'attachment',
    includeDesignSystemPreview: false,
  });

  expect(withPreview).toContain('https://pixso.example/file/abc');
  expect(withPreview).toContain('Focus on dashboard tokens.');
  expect(withPreview).toContain('also include design/proposals/design-source/design-system.html');
  expect(docsOnly).toContain('Do not include design-system.html');
});

test('html design-system reference wizard detail can carry files and auto-send intent', () => {
  const file = new File(['fake image'], 'reference.png', { type: 'image/png' });
  const detail = createHtmlDesignSystemReferenceDraftDetail({
    sourceKind: 'attachment',
    files: [file],
    notes: 'Extract banking UI rules.',
    includeDesignSystemPreview: true,
    autoSend: true,
  });

  expect(detail.draft).toContain('Extract banking UI rules.');
  expect(detail.files).toEqual([file]);
  expect(detail.autoSend).toBe(true);
});

test('html design-system reference wizard detail carries Pixso design-system directive', () => {
  const detail = createHtmlDesignSystemReferenceDraftDetail({
    sourceKind: 'pixso',
    pixsoUrl: 'https://pixso.net/app/editor/abc?node-id=12-34',
    includeDesignSystemPreview: true,
    autoSend: true,
  });

  expect(detail.draft).toContain('[SBER_DESIGNER_DESIGN_SOURCE]');
  expect(detail.draft).toContain('source=pixso');
  expect(detail.draft).toContain('targetMode=design-system');
  expect(detail.draft).toContain(
    `targetDesignSystemFilePath=design/proposals/${detail.proposalId}/Design.md`,
  );
  expect(detail.draft).toContain(
    `targetDesignSystemPreviewFilePath=design/proposals/${detail.proposalId}/design-system.html`,
  );
  expect(detail.draft).toContain(
    `targetExtractionReportFilePath=design/proposals/${detail.proposalId}/extraction-report.md`,
  );
  expect(detail.autoSend).toBe(true);
});

test('style scout accepts a generic reference URL and assigns a stable proposal target', () => {
  const proposalId = createHtmlDesignSystemReferenceProposalId(
    new Date('2026-07-18T10:11:12.345Z'),
  );
  const detail = createHtmlDesignSystemReferenceDraftDetail({
    sourceKind: 'url',
    referenceUrl: 'https://example.com/product/reference',
    proposalId,
  });

  expect(proposalId).toBe('style-scout-20260718t101112z');
  expect(detail.proposalId).toBe(proposalId);
  expect(detail.draft).toContain('https://example.com/product/reference');
  expect(detail.draft).toContain(`design/proposals/${proposalId}/Design.md`);
  expect(detail.draft).toContain('Do not write the active root Design.md or DESIGN.md');
  expect(detail.draft).toContain('9-section project style contract');
});
