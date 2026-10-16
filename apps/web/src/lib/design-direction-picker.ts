import type {
  DesignBrief,
  DesignDirectionOption,
  DesignDirectionSelection,
  ModalDefaults,
  ProjectScreenSurface,
} from '@sber-designer/shared-types';

export interface DirectionPickerMessagePayload {
  version: 1;
  requestMessageId: string;
  baseGeneration: {
    wireframe?: boolean;
    critique?: boolean;
    surface?: ProjectScreenSurface;
    modal?: ModalDefaults;
  };
  options: DesignDirectionOption[];
}

export type DirectionPickerPresentationPayload = Omit<
  DirectionPickerMessagePayload,
  'requestMessageId'
>;

export interface DirectionPickerTranscriptMessage {
  id: string;
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface PendingDirectionPicker {
  messageId: string;
  payload: DirectionPickerMessagePayload;
}

const DIRECTION_PRESETS = [
  {
    optionId: '1' as const,
    label: 'Workflow focus',
    summary: 'Prioritize one obvious primary task and keep secondary context subordinate.',
    layout: 'One dominant workflow with supporting context kept visually subordinate',
    density: 'balanced' as const,
    mood: 'Focused and direct',
  },
  {
    optionId: '2' as const,
    label: 'Operational overview',
    summary: 'Expose status, comparison, and decision context together for faster scanning.',
    layout: 'Information-rich overview with clear comparison and status regions',
    density: 'compact' as const,
    mood: 'Operational and precise',
  },
  {
    optionId: '3' as const,
    label: 'Guided progression',
    summary: 'Sequence the work into calm, explicit steps with stronger decision guidance.',
    layout: 'Progressive sequence with clear steps and contextual guidance',
    density: 'spacious' as const,
    mood: 'Calm and guided',
  },
] as const;

export function buildDesignDirectionOptions(
  baseBrief: DesignBrief | null | undefined,
): DesignDirectionOption[] {
  return DIRECTION_PRESETS.map((preset) => ({
    version: 1,
    optionId: preset.optionId,
    label: preset.label,
    summary: preset.summary,
    designBrief: {
      version: 1,
      source: 'direction-picker',
      axes: {
        ...baseBrief?.axes,
        layout: baseBrief?.axes.layout ?? preset.layout,
        density: baseBrief?.axes.density ?? preset.density,
        mood: baseBrief?.axes.mood ?? preset.mood,
      },
    },
  }));
}

export function formatDirectionPickerMessage(options: readonly DesignDirectionOption[]): string {
  return options.length === 3
    ? 'Choose a design direction before Assistant starts editing. Click one of the cards below — no typed reply is needed.'
    : 'Choose a design direction by clicking one of the cards below.';
}

export function findPendingDirectionPicker(
  messages: readonly DirectionPickerTranscriptMessage[],
): PendingDirectionPicker | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== 'assistant') continue;
    const payload = parseDirectionPickerMessagePayload(message.metadata);
    if (!payload) continue;
    if (!isDirectionPickerResolved(messages, index, payload)) {
      return { messageId: message.id, payload };
    }
  }
  return null;
}

export function isDirectionPickerResolved(
  messages: readonly DirectionPickerTranscriptMessage[],
  pickerIndex: number,
  payload: DirectionPickerMessagePayload,
): boolean {
  return messages.slice(pickerIndex + 1).some((message) => {
    if (message.role !== 'user') return false;
    const selection = message.metadata?.directionSelection;
    if (selection && typeof selection === 'object') {
      const optionId = (selection as { optionId?: unknown }).optionId;
      if (payload.options.some((option) => option.optionId === optionId)) return true;
    }
    return /^Use direction [123]:/u.test(message.content.trim());
  });
}

export function parseDirectionPickerMessagePayload(
  metadata: Record<string, unknown> | null | undefined,
): DirectionPickerMessagePayload | null {
  const candidate = metadata?.directionPicker;
  if (!candidate || typeof candidate !== 'object') return null;
  const value = candidate as Partial<DirectionPickerMessagePayload>;
  if (
    value.version !== 1 ||
    typeof value.requestMessageId !== 'string' ||
    !value.requestMessageId.trim() ||
    !value.baseGeneration ||
    typeof value.baseGeneration !== 'object' ||
    !Array.isArray(value.options) ||
    value.options.length !== 3 ||
    !value.options.every(isDesignDirectionOption)
  ) {
    return null;
  }
  return value as DirectionPickerMessagePayload;
}

export function selectionFromDirectionOption(
  option: DesignDirectionOption,
): DesignDirectionSelection {
  return {
    version: 1,
    optionId: option.optionId,
    label: option.label,
    summary: option.summary,
  };
}

function isDesignDirectionOption(value: unknown): value is DesignDirectionOption {
  if (!value || typeof value !== 'object') return false;
  const option = value as Partial<DesignDirectionOption>;
  return (
    option.version === 1 &&
    (option.optionId === '1' || option.optionId === '2' || option.optionId === '3') &&
    typeof option.label === 'string' &&
    Boolean(option.label.trim()) &&
    typeof option.summary === 'string' &&
    Boolean(option.summary.trim()) &&
    option.designBrief?.version === 1 &&
    option.designBrief.source === 'direction-picker' &&
    Boolean(option.designBrief.axes && Object.keys(option.designBrief.axes).length > 0)
  );
}
