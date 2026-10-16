import { buildHtmlDesignSystemApplyDirective } from '@sber-designer/shared-types';

export const HTML_DESIGN_SYSTEM_DISTILLATION_DRAFT_EVENT =
  'sber-designer:html-design-system-distillation-draft';

export interface HtmlDesignSystemDistillationDraftDetail {
  draft: string;
  autoSend?: boolean;
}

export function buildHtmlDesignSystemDistillationPrompt(input: {
  pages?: readonly string[] | null | undefined;
}): string {
  const pages = Array.from(new Set((input.pages ?? []).map((path) => path.trim()).filter(Boolean)));
  return [
    'Create Design.md for this HTML-first project by distilling the existing HTML pages.',
    '',
    'Use the design-system-distill workflow if available. Read the project index distillation prep first, then inspect only the listed pages when more evidence is needed.',
    '',
    pages.length > 0
      ? ['Existing HTML pages:', ...pages.map((path) => `- ${path}`)].join('\n')
      : 'Use the existing HTML pages in the project as evidence.',
    '',
    'Create a reviewable proposal under design/proposals with Design.md and extraction-report.md. Add tokens.css and components.css only for repeated, evidence-backed values/classes found in the pages.',
    '',
    'In extraction-report.md, list the repeated colors, typography, spacing, layout patterns, component patterns, source page evidence, conflicts, assumptions, and low-confidence fields.',
    '',
    'Do not edit production pages in this run.',
  ].join('\n\n');
}

export function createHtmlDesignSystemDistillationDraftDetail(
  input: {
    pages?: readonly string[] | null | undefined;
    autoSend?: boolean;
  } = {},
): HtmlDesignSystemDistillationDraftDetail {
  return {
    draft: buildHtmlDesignSystemDistillationPrompt({ pages: input.pages }),
    ...(input.autoSend ? { autoSend: true } : {}),
  };
}

export function buildHtmlDesignSystemApplyPrompt(input: {
  pages?: readonly string[] | null | undefined;
}): string {
  const pages = normalizedPages(input.pages);
  if (pages.length === 0) {
    throw new Error('HTML design-system apply requires at least one target page.');
  }
  return [
    'Apply the accepted HTML design system to the existing HTML pages.',
    '',
    buildHtmlDesignSystemApplyDirective(pages),
    '',
    pages.length > 0
      ? ['Target pages:', ...pages.map((path) => `- ${path}`)].join('\n')
      : 'Target the existing content HTML pages in the project.',
    '',
    'Use the active Design.md, tokens.css, and components.css as the source of truth: replace inline/raw values with Design.md, tokens.css, and components.css tokens/classes where the visual intent is equivalent.',
    '',
    'Keep the same page structure, content, links, forms, and screen root. Do not create or edit design-system proposal files in this run.',
    '',
    'Read-only during this apply run: design-system/Design.md, design-system/tokens.css, design-system/components.css, design-system/index.html, and root index.html.',
    '',
    'After editing each target page, run static render validation and preserve the root marker. If a replacement would change the visual intent, leave it unchanged and mention it in the summary.',
  ].join('\n\n');
}

export function createHtmlDesignSystemApplyDraftDetail(
  input: {
    pages?: readonly string[] | null | undefined;
    autoSend?: boolean;
  } = {},
): HtmlDesignSystemDistillationDraftDetail {
  return {
    draft: buildHtmlDesignSystemApplyPrompt({ pages: input.pages }),
    ...(input.autoSend ? { autoSend: true } : {}),
  };
}

export function dispatchHtmlDesignSystemDistillationDraft(
  detail: HtmlDesignSystemDistillationDraftDetail = createHtmlDesignSystemDistillationDraftDetail(),
  target: EventTarget = window,
): void {
  target.dispatchEvent(
    new CustomEvent(HTML_DESIGN_SYSTEM_DISTILLATION_DRAFT_EVENT, {
      detail,
    }),
  );
}

function normalizedPages(paths: readonly string[] | null | undefined): string[] {
  return Array.from(new Set((paths ?? []).map((path) => path.trim()).filter(Boolean))).sort();
}
