import { expect, test } from 'bun:test';

import {
  composeInterviewReply,
  defaultAnswerMode,
  defaultInterviewWriteTarget,
  interviewWriteTargetOptions,
  parseInterviewAnswerBlock,
  parseInterviewBlock,
  type InterviewBlock,
} from './interview-question';

const BLOCK: InterviewBlock = {
  componentId: 'atoms-typography-text',
  componentName: 'Text',
  progress: { index: 1, total: 8 },
  questions: [
    { id: 'purpose', label: 'Purpose', suggestion: 'Default text primitive.' },
    { id: 'use-when', label: 'Use when', suggestion: 'All UI body text.' },
    { id: 'variants', label: 'Variants' },
  ],
};

function message(block: unknown): string {
  return `Please answer these for Text.\n\n\`\`\`sd:interview\n${JSON.stringify(block)}\n\`\`\`\n`;
}

test('parseInterviewBlock extracts the block and strips it from the prose', () => {
  const { block, rest } = parseInterviewBlock(message(BLOCK));
  expect(block?.componentId).toBe('atoms-typography-text');
  expect(block?.componentName).toBe('Text');
  expect(block?.progress).toEqual({ index: 1, total: 8 });
  expect(block?.questions.map((q) => q.id)).toEqual(['purpose', 'use-when', 'variants']);
  expect(rest).toBe('Please answer these for Text.');
  expect(rest).not.toContain('sd:interview');
});

test('parseInterviewBlock is tolerant of missing/malformed blocks', () => {
  expect(parseInterviewBlock('just prose, no block').block).toBeNull();
  expect(parseInterviewBlock('```sd:interview\n{ not json }\n```').block).toBeNull();
  // A block without questions is not a valid interview block.
  expect(parseInterviewBlock(message({ componentId: 'x', questions: [] })).block).toBeNull();
});

test('parseInterviewBlock falls back to prose questions for weak models (E3)', () => {
  const prose = [
    "Let's describe the **Button** component (id: atoms-buttons-button).",
    '',
    '**Questions:**',
    '1. **Purpose:** What is this component for? *Suggestion: Primary action trigger.*',
    '2. **Use when:** When should it be used? *Suggestion: form submit; primary CTA*',
    '3. **Required props:** Which props are required? *Suggestion: children*',
    '4. **Keywords:** *Suggestion: button, action, cta*',
  ].join('\n');

  const { block, rest } = parseInterviewBlock(prose);
  expect(block?.componentId).toBe('atoms-buttons-button');
  expect(block?.componentName).toBe('Button');
  expect(block?.questions.map((q) => q.label)).toEqual([
    'Purpose',
    'Use when',
    'Required props',
    'Keywords',
  ]);
  expect(block?.questions[0]?.suggestion).toBe('Primary action trigger.');
  expect(block?.questions[1]?.suggestion).toBe('form submit; primary CTA');
  expect(block?.questions[3]?.suggestion).toBe('button, action, cta');
  // Prose is kept visible (we don't strip it), so nothing is lost.
  expect(rest).toContain('Button');
});

test('prose fallback ignores ordinary replies (no id, or only a weak label)', () => {
  // A normal screen-gen summary: kebab token but no interview labels.
  expect(
    parseInterviewBlock('Updated the payment-schedule screen and re-ran the build.').block,
  ).toBeNull();
  // Component id + only the weak "Purpose" label is not enough to be an interview.
  expect(
    parseInterviewBlock('The `atoms-buttons-button` component.\n\nPurpose: a button.').block,
  ).toBeNull();
});

test('defaultAnswerMode is accept when a suggestion exists, else own', () => {
  expect(defaultAnswerMode(BLOCK.questions[0]!)).toBe('accept');
  expect(defaultAnswerMode(BLOCK.questions[2]!)).toBe('own');
});

test('composeInterviewReply renders accept / own / skip per question', () => {
  const reply = composeInterviewReply(BLOCK, [
    { questionId: 'purpose', mode: 'accept' },
    { questionId: 'use-when', mode: 'own', text: 'Only running text, not headings.' },
    { questionId: 'variants', mode: 'skip' },
  ]);
  expect(reply).toBe(
    [
      'Answers for Text (atoms-typography-text):',
      '- Purpose: Default text primitive.',
      '- Use when: Only running text, not headings.',
      '- Variants: (skip)',
    ].join('\n'),
  );
});

test('composeInterviewReply appends a Write target directive only when given (Phase 3.1)', () => {
  const answers = [{ questionId: 'purpose', mode: 'accept' as const }];
  expect(composeInterviewReply(BLOCK, answers, 'storybook')).toContain('Write target: storybook');
  expect(composeInterviewReply(BLOCK, answers, 'design-system')).toContain(
    'Write target: design-system',
  );
  expect(composeInterviewReply(BLOCK, answers, 'sidecar')).toContain('Write target: sidecar');
  expect(composeInterviewReply(BLOCK, answers)).not.toContain('Write target:');
});

test('composeInterviewReply emits and parses a compact sd:answer block when a target is selected', () => {
  const reply = composeInterviewReply(
    BLOCK,
    [
      { questionId: 'purpose', mode: 'accept' },
      { questionId: 'use-when', mode: 'own', text: 'Only running text, not headings.' },
      { questionId: 'variants', mode: 'skip' },
    ],
    'storybook',
  );

  expect(reply).toContain('```sd:answer');
  const answer = parseInterviewAnswerBlock(reply);
  expect(answer).toEqual({
    componentId: 'atoms-typography-text',
    writeTarget: 'storybook',
    answers: {
      purpose: 'Default text primitive.',
      'use-when': 'Only running text, not headings.',
      variants: null,
    },
  });
});

test('composeInterviewReply keeps the legacy prose-only shape when no write target is selected', () => {
  const reply = composeInterviewReply(BLOCK, [{ questionId: 'purpose', mode: 'accept' }]);

  expect(reply).not.toContain('```sd:answer');
  expect(parseInterviewAnswerBlock(reply)).toBeNull();
});

test('write target options are profile-aware for Storybook and html-first projects', () => {
  expect(defaultInterviewWriteTarget('react-vite')).toBe('sidecar');
  expect(interviewWriteTargetOptions('react-vite').map((option) => option.target)).toEqual([
    'sidecar',
    'storybook',
  ]);

  expect(defaultInterviewWriteTarget('html-first')).toBe('design-system');
  expect(interviewWriteTargetOptions('html-first').map((option) => option.target)).toEqual([
    'design-system',
    'sidecar',
  ]);
});
