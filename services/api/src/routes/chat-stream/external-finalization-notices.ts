/**
 * Notices a finalized external-runtime turn appends to the transcript
 * (0136 R12 — extracted from external-finalization.ts).
 *
 * Each one explains, in the user's terms, why a run is being reported as
 * something other than a clean success — a missed selection target, no
 * visible write, a broken story/implementation invariant, a missing screen
 * root marker. Wording is product surface, so it lives together.
 */
import {
  type RuntimeExistingTargetState,
  type RuntimeStoryImplementationInvariant,
} from '../../agent-runtimes/change-validation';
import { type RuntimeScreenRootMarkerRepair } from '../../agent-runtimes/screen-root-marker-repair';
import { type SelectionTargetContractValidation } from '../../agent-runtimes/selection-target-contract';
import type { ExternalDesignSystemProposalValidation } from './external-design-system-proposal';

export function formatExternalCraftValidationNotice(summary: string, retryable: boolean): string {
  return [
    '',
    '',
    'sber-designer: Screen saved — craft findings need repair.',
    `Reason: ${summary}`,
    retryable
      ? 'The generated source is preserved for one bounded automatic repair.'
      : 'The requested screen edit is preserved without widening its scope; review pre-existing craft findings separately.',
  ].join('\n');
}

export function formatExternalRedesignFidelityNotice(): string {
  return [
    '',
    '',
    'sber-designer: Screen redesign fidelity needs review.',
    'The composition must change while original sections, facts, actions, states, and routes remain present.',
  ].join('\n');
}

export function formatNoVisibleWriteSummary(summaryText: string): string {
  return `no_visible_write: first visible implementation write was missing; ${summaryText}`;
}

export function formatExternalDesignSystemProposalNotice(
  validation: ExternalDesignSystemProposalValidation,
): string {
  return [
    '',
    '',
    'sber-designer: Design-system proposal incomplete.',
    `Verification: needs review - ${validation.reason}`,
    `Required files: ${validation.requiredFiles.join(', ') || 'not configured'}.`,
    `Missing files: ${validation.missingFiles.join(', ') || 'unknown'}.`,
    `Empty files: ${validation.emptyFiles.join(', ') || 'none'}.`,
    'The design-system import must remain reviewable before Accept can update project-owned Design.md/CSS files.',
  ].join('\n');
}

export function formatSelectionTargetMissedNotice(
  selectionTarget: SelectionTargetContractValidation,
): string {
  const selectedSource =
    selectionTarget.selectedFilePath && selectionTarget.selectedLine
      ? `${selectionTarget.selectedFilePath}:${selectionTarget.selectedLine}`
      : (selectionTarget.selectedFilePath ?? 'unknown');
  return [
    '',
    '',
    'sber-designer: selected edit target missed.',
    `Verification: failed - ${selectionTarget.reason}`,
    `Selected source: ${selectedSource}.`,
    `Changed files: ${selectionTarget.changedFiles.join(', ') || 'none'}.`,
    'The next repair should keep the edit scoped to the selected DOM/source element, or ask the user to clarify the selection.',
  ].join('\n');
}

export function formatRuntimeNoVisibleWriteNotice(input: {
  runtimeLabel: string;
  summaryText: string;
  existingTargetState: RuntimeExistingTargetState;
}): string {
  return [
    '',
    '',
    `sber-designer: ${input.runtimeLabel} finished before the first visible implementation write.`,
    `Verification: ${input.summaryText}`,
    `Existing target state: ${input.existingTargetState.reason}`,
    'This run was marked as failed so the blank/placeholder screen does not look like a successful image-to-screen result.',
  ].join('\n');
}

export function formatRuntimeStoryImplementationInvariantNotice(
  storyImplementation: RuntimeStoryImplementationInvariant,
): string {
  return [
    '',
    '',
    'sber-designer: Story implementation invariant failed.',
    `Verification: ${storyImplementation.reason}`,
    'The generated Storybook entry no longer points at a valid implementation export, so the run was marked as failed.',
  ].join('\n');
}

export function formatRuntimeScreenRootMarkerNotice(
  rootMarkerRepair: RuntimeScreenRootMarkerRepair,
): string {
  return [
    '',
    '',
    'sber-designer: Screen root marker verification failed.',
    `Verification: ${rootMarkerRepair.reason}`,
    'The active screen source must expose data-sd-screen-root so canvas render verification and Design mode can inspect the DOM.',
  ].join('\n');
}
