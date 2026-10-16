import {
  buildExternalDesignSourceDirective,
  createExternalDesignSystemProposalTargetDefaults,
  type ExternalDesignSourceIntent,
} from '@sber-designer/shared-types';

export const HTML_DESIGN_SYSTEM_REFERENCE_DRAFT_EVENT =
  'sber-designer:html-design-system-reference-draft';

export type HtmlDesignSystemReferenceSourceKind = 'attachment' | 'pixso' | 'url';

export interface HtmlDesignSystemReferencePromptOptions {
  sourceKind?: HtmlDesignSystemReferenceSourceKind;
  pixsoUrl?: string;
  referenceUrl?: string;
  proposalId?: string;
  notes?: string;
  includeDesignSystemPreview?: boolean;
}

export interface HtmlDesignSystemReferenceDraftDetail {
  draft: string;
  proposalId: string;
  sourceKind?: HtmlDesignSystemReferenceSourceKind;
  files?: File[];
  autoSend?: boolean;
}

export function buildHtmlDesignSystemReferencePrompt(
  options: HtmlDesignSystemReferencePromptOptions = {},
): string {
  const includeDesignSystemPreview = options.includeDesignSystemPreview ?? true;
  const proposalId = options.proposalId ?? 'design-source';
  const target = createExternalDesignSystemProposalTargetDefaults({ proposalId });
  return [
    'Create a project style-contract proposal from the attached screenshot, Pixso link, or reference URL.',
    '',
    sourceInstruction(options),
    pixsoDesignSystemDirective(options, proposalId),
    options.notes?.trim() ? `Additional notes:\n${options.notes.trim()}` : '',
    '',
    'Load the ai-design-system-scout skill before analysis.',
    '',
    `Use the reference only as design evidence. Write the reviewable draft to ${target.proposalRoot}. The required files are ${target.designSystemFilePath} and ${target.extractionReportFilePath}. Do not write the active root Design.md or DESIGN.md in this run.`,
    '',
    "Write Design.md using the complete canonical 9-section project style contract in order: Visual Theme & Atmosphere; Color Palette & Roles; Typography Rules; Component Stylings; Layout Principles; Depth & Elevation; Do's and Don'ts; Responsive Behavior; Agent Prompt Guide. Add tokens.css and components.css only when the evidence supports concrete reusable values.",
    '',
    'Accept copies optional tokens.css and components.css over the canonical runtime files. Include either optional file only when it is an activation-safe, complete replacement that preserves required imports and existing runtime contracts; otherwise omit it and keep the evidence in Design.md or extraction-report.md.',
    '',
    'In extraction-report.md, list the evidence used, extracted colors, typography, spacing, layout patterns, component patterns, assumptions, and every low-confidence field that needs human review.',
    '',
    includeDesignSystemPreview
      ? `If the reference has enough visible reusable UI patterns, also include ${target.designSystemPreviewFilePath} as a static preview/catalog. If the evidence is too thin, explain the gap in extraction-report.md instead.`
      : 'Do not include design-system.html in this proposal; focus on Design.md, extraction-report.md, and optional reusable CSS sources.',
    '',
    'Do not create or edit a screen implementation in this run.',
  ]
    .filter((line) => line !== '')
    .join('\n\n');
}

export function createHtmlDesignSystemReferenceDraftDetail(
  input: {
    sourceKind?: HtmlDesignSystemReferenceSourceKind;
    pixsoUrl?: string;
    referenceUrl?: string;
    proposalId?: string;
    notes?: string;
    includeDesignSystemPreview?: boolean;
    files?: File[];
    autoSend?: boolean;
  } = {},
): HtmlDesignSystemReferenceDraftDetail {
  const proposalId = input.proposalId ?? createHtmlDesignSystemReferenceProposalId();
  return {
    draft: buildHtmlDesignSystemReferencePrompt({ ...input, proposalId }),
    proposalId,
    ...(input.sourceKind ? { sourceKind: input.sourceKind } : {}),
    ...(input.files && input.files.length > 0 ? { files: input.files } : {}),
    ...(input.autoSend ? { autoSend: true } : {}),
  };
}

export function dispatchHtmlDesignSystemReferenceDraft(
  detail: HtmlDesignSystemReferenceDraftDetail = createHtmlDesignSystemReferenceDraftDetail(),
  target: EventTarget = window,
): void {
  target.dispatchEvent(
    new CustomEvent(HTML_DESIGN_SYSTEM_REFERENCE_DRAFT_EVENT, {
      detail,
    }),
  );
}

function sourceInstruction(options: HtmlDesignSystemReferencePromptOptions): string {
  if (options.sourceKind === 'pixso' && options.pixsoUrl?.trim()) {
    return `Use this Pixso link as the design reference:\n${options.pixsoUrl.trim()}`;
  }
  if (options.sourceKind === 'attachment') {
    return 'Use the attached reference file(s) as the design reference.';
  }
  if (options.sourceKind === 'url' && options.referenceUrl?.trim()) {
    return `Use this URL as the design reference:\n${options.referenceUrl.trim()}`;
  }
  return 'Use the attached screenshot, Pixso link, or reference URL as the design reference.';
}

function pixsoDesignSystemDirective(
  options: HtmlDesignSystemReferencePromptOptions,
  proposalId: string,
): string {
  const pixsoUrl = options.pixsoUrl?.trim();
  if (options.sourceKind !== 'pixso' || !pixsoUrl) return '';
  const target = createExternalDesignSystemProposalTargetDefaults({ proposalId });
  const intent: ExternalDesignSourceIntent = {
    source: {
      kind: 'pixso',
      input: 'link',
      url: pixsoUrl,
    },
    target: {
      mode: 'design-system',
      ...target,
    },
    policies: {
      tokens: 'allow-source-values',
      components: 'allow-new-components',
    },
  };
  return buildExternalDesignSourceDirective(intent);
}

export function createHtmlDesignSystemReferenceProposalId(now = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\.\d{3}Z$/u, 'z');
  return `style-scout-${stamp.toLowerCase()}`;
}
