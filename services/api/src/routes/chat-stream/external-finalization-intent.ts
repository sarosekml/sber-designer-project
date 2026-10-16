import type { RuntimeExistingTargetState } from '../../agent-runtimes/change-validation';
import type { TaskRelevantComponentPack } from '../../component-intelligence/component-pack';

export function shouldClassifyNoVisibleWrite(input: {
  componentPack: TaskRelevantComponentPack | null | undefined;
  existingTargetState: RuntimeExistingTargetState;
}): boolean {
  const taskKind = input.componentPack?.taskKind;
  const isScreenGeneration =
    taskKind === 'image-to-screen' ||
    taskKind === 'screen-generation' ||
    taskKind === 'screen-redesign';
  return isScreenGeneration && input.existingTargetState.status !== 'non_empty';
}
