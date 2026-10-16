/**
 * Pure form logic for the Design-panel Modal section (0132.3). The section reads
 * the committed values from the live DOM and stages a draft; these helpers keep
 * validation and the "only changed, valid fields" patch out of the component.
 */
import { parseModalDimension, type ModalLongContent } from '@sber-designer/shared-types';

export interface ModalSizeValues {
  width: string;
  height: string;
  longContent: ModalLongContent;
}

export interface ModalSizePatch {
  width?: string;
  height?: string;
  longContent?: ModalLongContent;
}

export function modalSizeFieldErrors(values: { width: string; height: string }): {
  width: boolean;
  height: boolean;
} {
  return {
    width:
      values.width.trim() !== '' && !parseModalDimension(values.width, { allowAuto: false }).ok,
    height:
      values.height.trim() !== '' && !parseModalDimension(values.height, { allowAuto: true }).ok,
  };
}

/**
 * Build the apply patch from the draft: only fields that are valid and actually
 * differ from what the DOM already shows. Returns null when nothing changed.
 */
export function modalSizePatchFromForm(
  committed: ModalSizeValues,
  draft: ModalSizeValues,
): ModalSizePatch | null {
  const patch: ModalSizePatch = {};
  const width = parseModalDimension(draft.width, { allowAuto: false });
  if (draft.width.trim() !== '' && width.ok && width.value && width.value !== committed.width) {
    patch.width = width.value;
  }
  const height = parseModalDimension(draft.height, { allowAuto: true });
  if (
    draft.height.trim() !== '' &&
    height.ok &&
    height.value &&
    height.value !== committed.height
  ) {
    patch.height = height.value;
  }
  if (draft.longContent !== committed.longContent) {
    patch.longContent = draft.longContent;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
