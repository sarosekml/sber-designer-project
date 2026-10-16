import type { ScreenReadinessProfile } from './screen-readiness';

/** User-wide defaults for optional screen generation stages. */
export interface GenerationPipelineDefaults {
  /** Show three direction choices before filling a newly created screen. */
  directionPicker?: boolean | undefined;
  /** Start newly created screens with a greybox pass. */
  wireframe?: boolean | undefined;
  /** Run the five-role Design Jury after screen-changing generation. */
  designJury?: boolean | undefined;
}

export interface ResolvedGenerationPipelineDefaults {
  directionPicker: boolean;
  wireframe: boolean;
  designJury: boolean;
}

export interface GenerationPipelinePreferences {
  /** Defaults applied across projects; Add a screen may override them for one run. */
  generationDefaults?: GenerationPipelineDefaults | undefined;
  /** Deterministic post-edit validation profile applied across projects. */
  screenReadiness?: ScreenReadinessProfile | undefined;
}

export const DEFAULT_GENERATION_PIPELINE_DEFAULTS: ResolvedGenerationPipelineDefaults = {
  directionPicker: false,
  wireframe: false,
  designJury: false,
};

export function resolveGenerationPipelineDefaults(
  input: GenerationPipelineDefaults | null | undefined,
  legacyDirectionPickerEnabled = false,
): ResolvedGenerationPipelineDefaults {
  return {
    directionPicker: input?.directionPicker ?? legacyDirectionPickerEnabled,
    wireframe: input?.wireframe ?? DEFAULT_GENERATION_PIPELINE_DEFAULTS.wireframe,
    designJury: input?.designJury ?? DEFAULT_GENERATION_PIPELINE_DEFAULTS.designJury,
  };
}

/** @deprecated Project files retain this alias only for legacy read compatibility. */
export type ProjectGenerationDefaults = GenerationPipelineDefaults;
/** @deprecated Use ResolvedGenerationPipelineDefaults. */
export type ResolvedProjectGenerationDefaults = ResolvedGenerationPipelineDefaults;
/** @deprecated Use DEFAULT_GENERATION_PIPELINE_DEFAULTS. */
export const DEFAULT_PROJECT_GENERATION_DEFAULTS = DEFAULT_GENERATION_PIPELINE_DEFAULTS;
/** @deprecated Use resolveGenerationPipelineDefaults. */
export const resolveProjectGenerationDefaults = resolveGenerationPipelineDefaults;
