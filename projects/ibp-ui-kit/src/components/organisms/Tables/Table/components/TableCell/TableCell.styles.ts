import { useCallback } from 'react';

import { Sx } from '@/utils';

import { TableColorSchema, TableStylesProps } from '../../TableProps';

export interface Props {
  isEditRender: boolean;
}

/*root table rules for cell*/
export const getBaseCellStyles =
  ({ isBordered }: Pick<TableStylesProps, 'isBordered'>): Sx =>
  (theme) => ({
    'td.TableCell-cell': {
      height: theme.spacing(12),
      fontVariantNumeric: 'tabular-nums',
      /* padding for readOnly render*/
      padding: theme.spacing(2, 2, 2, 4),
      '&:first-of-type': {
        paddingLeft: theme.spacing(6),
        '&[data-first-after-rowspan=true]': {
          paddingLeft: theme.spacing(4),
        },
      },
      '&:last-of-type': {
        paddingRight: theme.spacing(4),
      },
    },
    'td.TableGroupCell-cell': {
      '& .Container-wrapper': {
        zIndex: 1,
      },
    },

    /*border rules*/
    borderBottom: `1px solid ${theme.palette.Border.BorderLight}`,
    '&:last-of-type': {
      'td.TableCell-cell': {
        borderBottom: isBordered ? 'transparent' : undefined,
      },
      'td[rowspan].TableCell-cell': {
        borderBottom: isBordered ? 'transparent' : undefined,
      },
    },
  });

export const useCellStyles = (colorSchema: TableColorSchema | undefined): Sx =>
  useCallback(
    (theme) => ({
      position: 'relative',
      boxSizing: 'border-box',
      ...theme.typography.BodySReg,
      color: theme.palette.Text.TextPrimary,
      '& .dmb-uikit-MuiFormHelperText-root': {
        whiteSpace: 'break-spaces',
      },
      backgroundColor: colorSchema?.default,
      '&:hover, .dmb-uikit-MuiTableRow-root:hover &': {
        backgroundColor: colorSchema?.hover,
      },
      '&.dmb-uikit-MuiTableCell-root.TableFixedCell-fixedCell': {
        boxSizing: 'border-box',
        ...theme.typography.BodySReg,
        color: theme.palette.Text.TextPrimary,
        backgroundColor: colorSchema?.default ?? 'inherit',
        zIndex: 100,
        '&: hover': {
          backgroundColor: colorSchema?.hover,
        },
      },
    }),
    [colorSchema?.default, colorSchema?.hover],
  );

export const cellContentSx: Sx = {
  textAlign: 'inherit',
};
