import './Button.css';

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({ children, variant = 'primary', onClick, disabled }: ButtonProps) {
  return (
    <button className={`btn btn--${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
