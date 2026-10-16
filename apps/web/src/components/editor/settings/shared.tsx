/** Shared small UI bits for the settings panels. */

export function ProviderSwitch({
  enabled,
  disabled,
  title,
  onChange,
}: {
  enabled: boolean;
  disabled: boolean;
  title: string;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={
        'mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
        (enabled
          ? 'border-primary/70 bg-primary/70'
          : 'border-border bg-muted hover:border-primary/40')
      }
    >
      <span
        className={
          'block size-4 rounded-full shadow-sm transition-transform ' +
          (enabled ? 'translate-x-4 bg-primary-foreground' : 'translate-x-0 bg-background')
        }
      />
      <span className="sr-only">{enabled ? 'Enabled' : 'Disabled'}</span>
    </button>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'muted';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'ok'
      ? 'bg-success/15 text-success'
      : tone === 'danger'
        ? 'bg-destructive/20 text-destructive-foreground'
        : tone === 'muted'
          ? 'bg-muted text-muted-foreground'
          : 'bg-warning/15 text-warning';
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}
