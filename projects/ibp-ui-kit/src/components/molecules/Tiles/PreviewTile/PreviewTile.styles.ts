import { Sx } from '@/utils';

export const previewTileSx: Sx = {
  '& .dmb-uikit-MuiCardHeader-root': {
    backgroundColor: 'inherit',
    position: 'sticky',
    top: '0',
    /**
     * 601 - To be higher than table headers
     */
    zIndex: 601,
  },
  '& .dmb-uikit-MuiPaper-root .Layout-root': { height: 'initial' },
  '& > .dmb-uikit-MuiPaper-root': { overflow: 'auto' },
};
