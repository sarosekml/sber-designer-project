/** Shared field wrapper for the screens dialogs. */
import { Field as UiField, FieldLabel as UiFieldLabel } from '@/components/ui/field';

export function Field({
  label,
  labelHint,
  children,
}: {
  label: string;
  labelHint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <UiField className="min-w-0 gap-1.5">
      {labelHint ? (
        <div data-slot="field-label-row" className="flex w-fit items-center gap-1.5">
          <UiFieldLabel className="text-xs text-muted-foreground">{label}</UiFieldLabel>
          {labelHint}
        </div>
      ) : (
        <UiFieldLabel className="text-xs text-muted-foreground">{label}</UiFieldLabel>
      )}
      {children}
    </UiField>
  );
}
