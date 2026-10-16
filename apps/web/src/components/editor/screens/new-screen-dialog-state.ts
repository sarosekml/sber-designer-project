import type {
  DesignBrief,
  ModalDefaults,
  ProjectScreenSurface,
  ResolvedGenerationPipelineDefaults,
} from '@sber-designer/shared-types';

import { buildDesignDirectionOptions } from '@/lib/design-direction-picker';
import { generationOptionsForNewScreen } from './new-screen-dialog-helpers';

export type NewScreenDialogEntry = 'blank' | 'greybox' | 'prototype';

const PROTOTYPE_BRIEF =
  "Generate a first product prototype page using this project's Design.md, tokens.css, components.css, and existing static HTML patterns. Start with the primary workflow, realistic sample data, and responsive layout.";

export function buildNewScreenDialogOpeningState(input: {
  entry: NewScreenDialogEntry;
  screenName: string;
}): {
  tab: 'blank';
  name: string;
  brief: string;
  startWithWireframe: boolean;
} {
  if (input.entry === 'prototype') {
    return {
      tab: 'blank',
      name: input.screenName,
      brief: PROTOTYPE_BRIEF,
      startWithWireframe: true,
    };
  }
  if (input.entry === 'greybox') {
    return {
      tab: 'blank',
      name: input.screenName,
      brief: '',
      startWithWireframe: true,
    };
  }
  return {
    tab: 'blank',
    name: input.screenName,
    brief: '',
    startWithWireframe: false,
  };
}

export function resolveNewScreenGenerationRunDefaults(
  entry: NewScreenDialogEntry,
  defaults: ResolvedGenerationPipelineDefaults,
): ResolvedGenerationPipelineDefaults {
  return {
    ...defaults,
    wireframe: defaults.wireframe || entry === 'greybox' || entry === 'prototype',
  };
}

export function resolveNewScreenGenerationDispatch(input: {
  directionPicker: boolean;
  wireframe: boolean;
  critique: boolean;
  designBrief: DesignBrief | null;
  surface?: ProjectScreenSurface;
  modal?: ModalDefaults;
}) {
  const requestOptions = generationOptionsForNewScreen(
    input.wireframe,
    input.critique,
    input.designBrief,
    input.surface
      ? {
          surface: input.surface,
          ...(input.modal ? { modal: input.modal } : {}),
        }
      : undefined,
  );
  if (!input.directionPicker) {
    return { kind: 'send' as const, requestOptions };
  }
  return {
    kind: 'direction-picker' as const,
    payload: {
      version: 1 as const,
      baseGeneration: {
        ...(input.wireframe ? { wireframe: true } : {}),
        ...(input.critique ? { critique: true } : {}),
        ...(input.surface ? { surface: input.surface } : {}),
        ...(input.modal ? { modal: input.modal } : {}),
      },
      options: buildDesignDirectionOptions(input.designBrief),
    },
  };
}
