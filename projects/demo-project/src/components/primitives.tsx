import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variantClass =
    variant === 'dangerOutline' ? 'btn-danger-outline' : `btn-${variant.toLowerCase()}`;
  return (
    <button
      className={['btn', variantClass, `btn-${size}`, iconOnly ? 'btn-icon' : '', className]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12a9 9 0 1 1-6.219-8.56"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

export function KebabButton({
  label = 'More actions',
  ...props
}: Omit<ButtonProps, 'children' | 'iconOnly'> & { label?: string }) {
  return (
    <Button aria-label={label} iconOnly variant="secondary" {...props}>
      <KebabIcon />
    </Button>
  );
}

export function ButtonGroup({
  items,
  active,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & { items: string[]; active: string }) {
  return (
    <div className={['btn-group', className].filter(Boolean).join(' ')} {...props}>
      {items.map((item) => (
        <button key={item} className={item === active ? 'is-active' : undefined} type="button">
          {item}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl({
  items,
  active,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & { items: string[]; active: string }) {
  return (
    <div className={['seg', className].filter(Boolean).join(' ')} {...props}>
      {items.map((item) => (
        <button key={item} className={item === active ? 'is-active' : undefined} type="button">
          {item}
        </button>
      ))}
    </div>
  );
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <div className="field">
      <label className="field-label">
        {label} {required ? <span className="req">*</span> : null}
      </label>
      {children}
      {error ? <div className="field-error">{error}</div> : null}
      {hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid = false, className = '', ...props }: TextInputProps) {
  return <input className={['input', invalid ? 'is-error' : '', className].join(' ')} {...props} />;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid = false, className = '', ...props }: TextareaProps) {
  return (
    <textarea className={['textarea', invalid ? 'is-error' : '', className].join(' ')} {...props} />
  );
}

export function SelectControl({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="select-wrap">
      <select className={['select', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
    </div>
  );
}

export function SearchField({
  placeholder = 'Find asset, fund, or idea',
}: {
  placeholder?: string;
}) {
  return (
    <div className="input-group">
      <span className="leading">
        <SearchIcon />
      </span>
      <input className="input has-leading" placeholder={placeholder} />
    </div>
  );
}

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & {
  label: ReactNode;
  className?: string;
};

export function Checkbox({ label, className = '', ...props }: ChoiceProps) {
  return (
    <label className={['check', className].filter(Boolean).join(' ')}>
      <input type="checkbox" {...props} />
      <span className="box" />
      {label}
    </label>
  );
}

export function Radio({ label, className = '', ...props }: ChoiceProps) {
  return (
    <label className={['radio', className].filter(Boolean).join(' ')}>
      <input type="radio" {...props} />
      <span className="dot" />
      {label}
    </label>
  );
}

export function Toggle({ label, className = '', ...props }: ChoiceProps) {
  return (
    <label className={['toggle', className].filter(Boolean).join(' ')}>
      <input type="checkbox" {...props} />
      <span className="track" />
      {label}
    </label>
  );
}

export function CommandSearch({
  placeholder = 'Search the platform...',
  shortcut = '⌘K',
}: {
  placeholder?: string;
  shortcut?: string | null;
}) {
  return (
    <label className="search">
      <SearchIcon />
      <input placeholder={placeholder} />
      {shortcut ? <span className="kbd">{shortcut}</span> : null}
    </label>
  );
}

export type BadgeTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'violet'
  | 'neutral'
  | 'solid-success'
  | 'solid-info'
  | 'solid-danger'
  | 'solid-neutral';

export function Badge({
  tone = 'neutral',
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  );
}

export type TagTone = 'hotel' | 'metal' | 'pharma' | 'bank' | 'it' | 'finance' | 'soft' | 'capital';

export function Tag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export type PillTone = 'high' | 'strategic' | 'growth' | 'warn' | 'neutral';

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Status({
  tone,
  children,
}: {
  tone: 'active' | 'paused' | 'archived';
  children: ReactNode;
}) {
  return (
    <span className={`status status-${tone}`}>
      <span className="d" />
      {children}
    </span>
  );
}

export function PriorityBadge({
  tone,
  children,
}: {
  tone: 'high' | 'mid' | 'low';
  children: ReactNode;
}) {
  return (
    <span className={`prio prio-${tone}`}>
      <span className="d" />
      {children}
    </span>
  );
}

export function AiBadge({ children = 'AI Recommendation' }: { children?: ReactNode }) {
  return <span className="ai-badge">{children}</span>;
}

export function Avatar({
  size = 'md',
  tone = 'emerald',
  children,
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'emerald' | 'violet' | 'amber' | 'blue' | 'rose' | 'neutral';
  children: ReactNode;
}) {
  return <span className={`avatar avatar-${size} avatar-${tone}`}>{children}</span>;
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
