import { Sx } from '@/utils';

import { baseHeaderStyles } from './components/HeaderCell/HeaderCell.styles';
import { getBaseCellStyles } from './components/TableCell/TableCell.styles';
import { TableStylesProps } from './TableProps';

export interface TableStylesType {
  root?: string;
  loader?: string;
}

export const tableZIndexes = {
  table: 600,
  stickyTable: 500,
  toggleColumnsButton: 700,
  configIcon: 100,
  iconWrapper: 100,
};

const paginatorStyles: Sx = (theme) => ({
  height: '48px',
  flexWrap: 'nowrap',
  columnGap: theme.spacing(14),
  padding: `${theme.spacing(3, 5)} !important`, //@todo find how to set correct padding

  //#paginator page size selector
  '& .PageSizeSelector-pageSizeSelector': {
    padding: 0,
    columnGap: theme.spacing(2),
  },
  '& .PageSizeSelector-label': {
    ...theme.typography.BodyMReg,
    padding: 0,
  },
  '& .dmb-uikit-MuiInput-input': {
    ...theme.typography.BodyMReg,
    padding: 0,
    paddingRight: '28px !important', //@todo find how to set correct padding
    minHeight: '1em',
  },
  '& .PageSizeSelector-selectIcon': {
    top: 'unset',
    height: theme.spacing(5),
    width: theme.spacing(5),
    color: theme.palette.Secondary.Secondary,
  },

  //#paginator page counter and buttons
  '& .Pagination-pagination': {
    '& .Pagination-rowsLabel': {
      ...theme.typography.BodyMReg,
      paddingRight: theme.spacing(13.5),
    },
    '& .dmb-uikit-MuiButtonBase-root': {
      padding: theme.spacing(0, 1.5),
      '& :first-child': {
        color: theme.palette.Secondary.Secondary,
        width: theme.spacing(5),
        height: theme.spacing(5),
      },
    },
  },
});

export const getTableStyles =
  ({ isBordered, height }: TableStylesProps): Sx =>
  (theme) => ({
    borderRadius: 2,
    boxShadow: 'none',
    position: 'relative',
    overflow: isBordered ? 'hidden' : 'auto',
    border: isBordered ? `1px solid ${theme.palette.Border.BorderLight}` : '',
    '& .Layout-root': {
      height: '100%',
      maxHeight: height ?? '100%',
    },

    /*root table rules for header*/
    'tr th.CellLayout-cell': baseHeaderStyles,

    /*base table rows and cells styles*/
    tr: getBaseCellStyles({ isBordered }),

    /*base paginator*/
    '& .Pager-pager': paginatorStyles,
  });

/*loader centering*/
export const loaderSx: Sx = (theme) => ({
  /*
    it's expected that .dmb-uikit-MuiPaper-root has
    position "relative" which is true right now
  */
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: theme.palette.Primary.PrimaryBGSemiTransparent,
});
