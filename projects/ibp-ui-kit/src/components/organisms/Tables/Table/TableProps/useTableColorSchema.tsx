import { useTheme } from '@mui/material';
import { TableColorSchema } from './TableRow.types';

export const useTableColorSchema = (): Required<TableColorSchema> => {
  const theme = useTheme();
  return {
    focus: theme.palette.BG.BGTableDefaultFocus,
    hover: theme.palette.BG.BGTableDefaultHover,
    default: 'white',
  };
};
