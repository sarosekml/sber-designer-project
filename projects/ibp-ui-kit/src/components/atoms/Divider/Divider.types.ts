export type Color = 'primary' | 'light' | 'dark';

export interface DividerProps {
  color?: Color;
  orientation: 'horizontal' | 'vertical';
  flexItem: boolean;
}

export type StylesProps = Pick<DividerProps, 'color'>;
