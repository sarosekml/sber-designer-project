import type { ModalDefaults, ModalLongContent } from '@sber-designer/shared-types';

import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Field } from './dialog-shared';

export function ModalCreationFields({
  defaults,
  width,
  height,
  longContent,
  widthInvalid,
  heightInvalid,
  disabled,
  onWidthChange,
  onHeightChange,
  onLongContentChange,
}: {
  defaults: ModalDefaults;
  width: string;
  height: string;
  longContent: ModalLongContent;
  widthInvalid: boolean;
  heightInvalid: boolean;
  disabled: boolean;
  onWidthChange: (value: string) => void;
  onHeightChange: (value: string) => void;
  onLongContentChange: (value: ModalLongContent) => void;
}) {
  const invalid = widthInvalid || heightInvalid;
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <Field label="Width">
          <Input
            value={width}
            onChange={(event) => onWidthChange(event.target.value)}
            placeholder={defaults.width}
            disabled={disabled}
            aria-invalid={widthInvalid || undefined}
          />
        </Field>
        <Field label="Height">
          <Input
            value={height}
            onChange={(event) => onHeightChange(event.target.value)}
            placeholder={longContent === 'grow' ? 'auto' : defaults.height}
            disabled={disabled || longContent === 'grow'}
            aria-invalid={heightInvalid || undefined}
          />
        </Field>
      </div>
      <Field label="Long content">
        <div className="[&_[data-slot=native-select-wrapper]]:w-full">
          <NativeSelect
            value={longContent}
            onChange={(event) => onLongContentChange(event.target.value as ModalLongContent)}
            className="h-10 w-full"
            disabled={disabled}
          >
            <NativeSelectOption value="scroll">Scroll body</NativeSelectOption>
            <NativeSelectOption value="grow">Grow modal</NativeSelectOption>
          </NativeSelect>
        </div>
      </Field>
      <p className="text-xs text-muted-foreground">
        {invalid
          ? 'Use a length like 300px, 50%, or 40rem; height also accepts auto.'
          : longContent === 'grow'
            ? 'Height is automatic while Grow modal is selected.'
            : 'The modal renders its own scrim and centers this dialog.'}
      </p>
    </div>
  );
}
