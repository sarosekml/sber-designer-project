import { DataTestIdProps } from '@/types';

// export type Ran<T extends number> = number extends T ? number : _Range<T, []>;
// type _Range<T extends number, R extends unknown[]> = R['length'] extends T ? R[number] : _Range<T, [R['length'], ...R]>;

export interface ProgressBarProps extends Partial<DataTestIdProps> {
  label?: string;
  value?: number; //Ran<101>;
}
