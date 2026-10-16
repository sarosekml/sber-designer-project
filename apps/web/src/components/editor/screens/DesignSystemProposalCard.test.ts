import { expect, test } from 'bun:test';

import { buildDesignSystemProposalCardModel } from './DesignSystemProposalCard';

test('design-system proposal card model exposes accept and reject actions', () => {
  const model = buildDesignSystemProposalCardModel({
    proposals: [
      {
        id: '2026-07-05-1015',
        filePath: 'design/proposals/2026-07-05-1015',
        ready: true,
        updatedAt: 1,
        files: [
          {
            path: 'design/proposals/2026-07-05-1015/Design.md',
            label: 'Design.md',
            required: true,
            exists: true,
            excerpt: '# Design',
          },
          {
            path: 'design/proposals/2026-07-05-1015/tokens.css',
            label: 'tokens.css',
            required: true,
            exists: true,
            excerpt: ':root { --color-brand: #14532d; }',
          },
        ],
        reportExcerpt: '# Extraction report',
      },
    ],
    loading: false,
    error: null,
  });

  expect(model.visible).toBe(true);
  expect(model.title).toBe('Design system proposal ready');
  expect(model.primaryProposal?.id).toBe('2026-07-05-1015');
  expect(model.acceptDisabled).toBe(false);
  expect(model.rejectDisabled).toBe(false);
  expect(model.fileLabels).toEqual(['Design.md', 'tokens.css']);
});

test('style-contract proposal cannot be accepted until all nine sections are ready', () => {
  const model = buildDesignSystemProposalCardModel({
    proposals: [
      {
        id: 'style-scout-test',
        filePath: 'design/proposals/style-scout-test',
        ready: false,
        updatedAt: 1,
        files: [],
        reportExcerpt: '# Extraction report',
        styleContract: {
          required: true,
          recognized: true,
          complete: false,
          presentSections: 7,
          totalSections: 9,
          diagnostics: ['Missing Responsive Behavior and Agent Prompt Guide.'],
        },
      },
    ],
    loading: false,
    error: null,
  });

  expect(model.acceptDisabled).toBe(true);
  expect(model.rejectDisabled).toBe(false);
  expect(model.title).toBe('Style contract proposal needs revision');
  expect(model.message).toContain('complete all nine');
});
