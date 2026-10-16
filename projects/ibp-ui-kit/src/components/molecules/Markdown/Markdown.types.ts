import { DataTestIdProps } from '@/types';
import { Sx } from '@/utils';

export type MarkdownProps = {
  children: string;
  sx?: Sx;
} & DataTestIdProps;
