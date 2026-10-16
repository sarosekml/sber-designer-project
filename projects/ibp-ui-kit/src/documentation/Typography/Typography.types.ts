import { TextTypes } from '@/styles/theme/typography';

export interface Description {
  kind: TextTypes;
  text: string;
}

export interface FontDescription {
  subtitle: string;
  data: Description[];
}
