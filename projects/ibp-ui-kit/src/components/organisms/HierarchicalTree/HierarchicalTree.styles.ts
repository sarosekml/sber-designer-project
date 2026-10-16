import { Sx } from '@/utils';

import { defaultTreeCellWidth } from './controllers';

export const hierarchicalTreeStyles: Sx = (theme) => ({
  backgroundColor: theme.palette.BG.BGTableDefault,
  border: `1px solid ${theme.palette.Border.BorderLight}`,
  borderRadius: theme.spacing(2),
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  width: '100%',
});

export const getHeaderCellStyles =
  (columnWidth?: number): Sx =>
  (theme) => {
    return {
      '.headerActions': {
        flexShrink: 0,
        fontSize: theme.spacing(3.5),
        padding: theme.spacing(2),
      },
      '.headerTitle': {
        color: theme.palette.Text.TextSecondary,
        cursor: 'text',
        flexGrow: 1,
        fontSize: theme.spacing(3.5),
        padding: theme.spacing(2),
        whiteSpace: 'pre-line',
        wordWrap: 'break-word',
        minWidth: 0,
      },
      '.resizeHandle': {
        '&:hover': {
          borderRight: `2px solid ${theme.palette.Status.StGreenLight}`,
        },
        bottom: 0,
        cursor: 'col-resize',
        position: 'absolute',
        right: 0,
        top: 0,
        width: '3px',
        zIndex: 1,
      },
      '.resizeHandle.active': {
        borderRight: `2px solid ${theme.palette.Status.StGreenLight}`,
        '.resizing &': {
          borderRight: 'none',
        },
      },
      alignItems: 'center',
      borderBottom: `1px solid ${theme.palette.Border.BorderPrimary}`,
      boxSizing: 'border-box',
      display: 'flex',
      height: '100%',
      justifyContent: 'space-between',
      padding: 0,
      position: 'relative',
      width: `${columnWidth}px`,
      minWidth: `${columnWidth}px`,
      maxWidth: `${columnWidth}px`,
      overflow: 'hidden',
      flexShrink: 0,
    };
  };

export const getTreeNodeCellStyles =
  (isLastLevel: boolean, nodeLevelPadding: number, nodeLevel: number, cellWidth: number, isLeaf?: boolean): Sx =>
  (theme) => {
    return {
      width: `${cellWidth}px`,
      minWidth: `${cellWidth}px`,
      maxWidth: `${cellWidth}px`,
      display: 'flex',
      alignItems: 'center',
      padding: 0,
      borderBottom: `1px solid ${theme.palette.Border.BorderLight}`,
      backgroundColor: theme.palette.BG.BGTableDefault,
      overflow: 'hidden',
      flexShrink: 0,

      '.treeNodeContent': {
        cursor: isLeaf ? 'pointer' : isLastLevel ? 'auto' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
      },

      '.singleNodeLayerContainer': {
        display: 'flex',
        alignItems: 'center',
        fontSize: theme.spacing(3.5),
        color: theme.palette.Text.TextPrimary,
        width: '100%',
        minWidth: 0,
        paddingY: theme.spacing(4),
        paddingLeft: theme.spacing(6),
      },

      '.treeNodeIcon': {
        color: theme.palette.Secondary.Secondary,
        flexShrink: 0,
      },

      '.treeNodeIconWrapper': {
        paddingX: theme.spacing(2),
        paddingLeft: nodeLevelPadding * 24 + 'px',
        flexShrink: 0,
      },

      '.treeNodeTitle': {
        paddingX: theme.spacing(2),
        paddingLeft: 0,
        color: theme.palette.Text.TextPrimary,
        ...(isLeaf
          ? { ...theme.typography.BodySReg, paddingLeft: nodeLevelPadding * 16 + 'px' }
          : { ...theme.typography.BodySStrongSmb }),
        minWidth: 0,
        flex: 1,
      },
    };
  };
export const getRawNodeCellStyles =
  (cellWidth?: number | 'auto'): Sx =>
  (theme) => {
    const width = cellWidth && cellWidth !== 'auto' ? `${cellWidth}px` : theme.spacing(50);

    return {
      backgroundColor: theme.palette.BG.BGTableDefault,
      borderBottom: `1px solid ${theme.palette.Border.BorderLight}`,
      boxSizing: 'border-box',
      color: theme.palette.Text.TextPrimary,
      display: 'flex',
      fontSize: theme.spacing(3.5),
      paddingX: theme.spacing(2),
      paddingY: theme.spacing(4),
      whiteSpace: 'nowrap',
      zIndex: 1,
      flexShrink: 0,
      width: width,
      minWidth: width,
      maxWidth: width,
      '& > *': {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        width: '100%',
      },
    };
  };
