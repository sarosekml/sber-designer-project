import { Theme } from '@mui/system';

export const getColors = ({ palette }: Theme, filter: string) => {
  const colorGroup = palette[filter];
  if (!colorGroup) return [];
  return Object.entries<string>(colorGroup).map(([name, hex]) => ({ name, hex }));
};
