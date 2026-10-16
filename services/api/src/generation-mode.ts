import { z } from 'zod';
import {
  DESIGN_BRIEF_AXIS_KEYS,
  DESIGN_BRIEF_AXIS_LABELS,
  designBriefForbidsExistingScreenReferences,
  type DesignBrief,
  type DesignBriefAxes,
  type DesignDirectionSelection,
  MODAL_FALLBACK_DEFAULTS,
  normalizeModalDefaults,
} from '@sber-designer/shared-types';

const DesignBriefTextSchema = z.string().trim().min(1).max(400);

export const DesignBriefSchema = z
  .object({
    version: z.literal(1),
    source: z.enum(['request', 'mini-form', 'direction-picker']),
    axes: z
      .object({
        palette: DesignBriefTextSchema.optional(),
        typography: DesignBriefTextSchema.optional(),
        layout: DesignBriefTextSchema.optional(),
        mood: DesignBriefTextSchema.optional(),
        density: z.enum(['compact', 'balanced', 'spacious']).optional(),
        constraints: z.array(DesignBriefTextSchema).min(1).max(8).optional(),
      })
      .strict()
      .refine((axes) => DESIGN_BRIEF_AXIS_KEYS.some((axis) => axes[axis] !== undefined), {
        message: 'Design brief must define at least one axis.',
      }),
  })
  .strict();

export const DesignDirectionSelectionSchema = z
  .object({
    version: z.literal(1),
    optionId: z.enum(['1', '2', '3']),
    label: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(400),
  })
  .strict();

export const GenerationOptionsSchema = z
  .object({
    wireframe: z.boolean().optional(),
    critique: z.boolean().optional(),
    designBrief: DesignBriefSchema.optional(),
    directionSelection: DesignDirectionSelectionSchema.optional(),
    surface: z.enum(['page', 'modal']).optional(),
    modal: z
      .object({
        width: z.string(),
        height: z.string(),
        longContent: z.enum(['scroll', 'grow']),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((generation, context) => {
    if (generation.modal && generation.surface !== 'modal') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Modal defaults require surface: modal.',
        path: ['modal'],
      });
    }
    if (generation.modal) {
      const normalized = normalizeModalDefaults(generation.modal, MODAL_FALLBACK_DEFAULTS);
      if (normalized.issues.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: normalized.issues.join(' '),
          path: ['modal'],
        });
      }
    }
  })
  .refine(
    (generation) =>
      !generation.directionSelection || generation.designBrief?.source === 'direction-picker',
    {
      message: 'A selected direction requires a direction-picker design brief.',
      path: ['directionSelection'],
    },
  );

export type GenerationOptions = z.infer<typeof GenerationOptionsSchema>;

export type ScreenCraftProfile = 'standard' | 'wireframe';

export function instructionHierarchyPromptSection(): string {
  return [
    '## Instruction hierarchy',
    '',
    '- Harness safety, allowed-target, source-integrity, and factual/accessibility requirements remain mandatory.',
    '- For design, content, component, composition, and reference choices, use this order:',
    '  1. The current explicit user request for this run.',
    '  2. Explicit Design brief fields, selected direction/template, and per-run generation options.',
    '  3. Compatible project evidence: documented components, tokens, templates, and style memory.',
    '  4. Generic harness defaults, exploration suggestions, and nearby-screen advice.',
    '- When two compatible design instructions conflict, follow the higher-priority one and discard the lower-priority instruction instead of blending them.',
    '- In particular, generic advice to inspect or reuse nearby screens never overrides an explicit user instruction not to use existing screens.',
  ].join('\n');
}

export function generationModePromptSection(
  generation: GenerationOptions | null | undefined,
): string {
  if (!generation?.wireframe) return '';
  return [
    '## Generation Mode',
    '',
    'Wireframe mode is enabled for this run.',
    '- Load and follow the `screen-wireframe` skill before editing files.',
    '- Produce a greybox first pass: structure, hierarchy, states, and project component/catalog reuse before final visual styling.',
    '- Use neutral skeleton labels and factual copy only; avoid invented production metrics.',
    '- Do not run a polish pass unless the user asks for high-fidelity output in a follow-up.',
    '- In the final response, suggest `apply visual style` as the next follow-up when the greybox structure is ready.',
  ].join('\n');
}

export function designBriefPromptSection(generation: GenerationOptions | null | undefined): string {
  const brief = generation?.designBrief;
  if (!brief) return '';
  const direction = generation?.directionSelection;
  const forbidsExistingScreenReferences = designBriefForbidsExistingScreenReferences(brief);
  const specified = renderSpecifiedDesignBriefAxes(brief.axes);
  const missing = DESIGN_BRIEF_AXIS_KEYS.filter((axis) => brief.axes[axis] === undefined);
  return [
    '## Design brief',
    '',
    `Source: ${brief.source}`,
    ...(direction
      ? [
          `Selected direction: ${direction.optionId}. ${direction.label}`,
          `Direction intent: ${direction.summary}`,
        ]
      : []),
    '',
    'Explicit axes:',
    ...specified,
    ...(missing.length > 0
      ? [
          '',
          'Unspecified axes:',
          ...missing.map((axis) => `- ${DESIGN_BRIEF_AXIS_LABELS[axis]}: not specified`),
        ]
      : []),
    '',
    'Brief contract:',
    '- Preserve every explicit axis unless it conflicts with project-owned tokens, components, accessibility, or factual requirements.',
    forbidsExistingScreenReferences
      ? '- Existing-screen reference policy: do not inspect or derive layout, content, or visual direction from existing screen/page implementations. Component source and Storybook examples may be inspected only to verify API and imports.'
      : '- For an unspecified axis, prefer evidence from the project index, nearby screens, templates, and style memory.',
    ...(forbidsExistingScreenReferences
      ? [
          '- For an unspecified axis, prefer project tokens, component documentation, templates, and style memory without using existing screen/page implementations.',
        ]
      : []),
    '- If missing information would materially change the first write and project evidence is insufficient, ask one concise question before editing.',
    '- Otherwise choose the smallest project-compatible default and disclose it in the final response as an assumed default.',
    '- Treat Constraints as hard requirements. The current user request wins if it explicitly overrides this run brief.',
  ].join('\n');
}

export function renderDesignBriefSummary(brief: DesignBrief): string[] {
  return renderSpecifiedDesignBriefAxes(brief.axes);
}

export function renderDirectionSelectionSummary(selection: DesignDirectionSelection): string {
  return `${selection.optionId}. ${selection.label} — ${selection.summary}`;
}

function renderSpecifiedDesignBriefAxes(axes: DesignBriefAxes): string[] {
  const lines: string[] = [];
  for (const axis of DESIGN_BRIEF_AXIS_KEYS) {
    const value = axes[axis];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`- ${DESIGN_BRIEF_AXIS_LABELS[axis]}:`, ...value.map((item) => `  - ${item}`));
      continue;
    }
    lines.push(`- ${DESIGN_BRIEF_AXIS_LABELS[axis]}: ${value}`);
  }
  return lines;
}

export function screenCraftProfileForGeneration(
  generation: GenerationOptions | null | undefined,
): ScreenCraftProfile {
  return generation?.wireframe ? 'wireframe' : 'standard';
}
