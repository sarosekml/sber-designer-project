/** Structured, run-owned design intent for screen generation and review. */

export type DesignBriefSource = 'request' | 'mini-form' | 'direction-picker';

export type DesignBriefDensity = 'compact' | 'balanced' | 'spacious';

export type DesignDirectionId = '1' | '2' | '3';

export interface DesignBriefAxes {
  palette?: string | undefined;
  typography?: string | undefined;
  layout?: string | undefined;
  mood?: string | undefined;
  density?: DesignBriefDensity | undefined;
  constraints?: string[] | undefined;
}

/**
 * Explicit design choices supplied for one generation run. Missing axes are
 * intentional: the prompt contract tells the agent to use project evidence or
 * disclose an assumed default instead of silently inventing a preference.
 */
export interface DesignBrief {
  version: 1;
  source: DesignBriefSource;
  axes: DesignBriefAxes;
}

export interface DesignDirectionSelection {
  version: 1;
  optionId: DesignDirectionId;
  label: string;
  summary: string;
}

export interface DesignDirectionOption extends DesignDirectionSelection {
  designBrief: DesignBrief;
}

export const DESIGN_BRIEF_AXIS_LABELS = {
  palette: 'Palette',
  typography: 'Typography',
  layout: 'Layout',
  mood: 'Mood',
  density: 'Density',
  constraints: 'Constraints',
} as const satisfies Record<keyof DesignBriefAxes, string>;

export const DESIGN_BRIEF_AXIS_KEYS = Object.keys(
  DESIGN_BRIEF_AXIS_LABELS,
) as (keyof DesignBriefAxes)[];

export function designBriefForbidsExistingScreenReferences(
  brief: DesignBrief | null | undefined,
): boolean {
  return (brief?.axes.constraints ?? []).some(
    (constraint) =>
      /\b(?:do\s+not|don['’]t|never)\s+(?:use|inspect|read|copy|reference|derive\s+from)\b[^.\n]{0,80}\b(?:screens?|pages?)\b/iu.test(
        constraint,
      ) ||
      /(?<![\p{L}\p{N}_])не\s+(?:используй|используйте|использовать|изучай|изучайте|изучать|читай|читайте|читать|копируй|копируйте|копировать)(?=$|\s|[.,:;!?])[^.\n]{0,80}(?:экран|страниц)\p{L}*/iu.test(
        constraint,
      ),
  );
}
