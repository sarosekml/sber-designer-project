import { MediumSizeType } from '@/types';
import { Sx, Theme } from '@/utils';

const getPaddingBottom = (theme: Theme, size: MediumSizeType) => {
  if (size === 'lg') return theme.spacing(2.5);
  if (size === 'md') return theme.spacing(2.5);
  return theme.spacing(0.5);
};

const getBackgroundImage = (
  isDragAndDropContainer: boolean,
  dragAndDropContainerState?: 'default' | 'active' | 'disabled',
) => {
  if (!isDragAndDropContainer || !dragAndDropContainerState) return undefined;
  if (dragAndDropContainerState === 'disabled')
    return `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='8' ry='8' stroke='%23E8EDEDFF' stroke-width='2' stroke-dasharray='8' stroke-dashoffset='4' stroke-linecap='round'/%3e%3c/svg%3e")`;
  if (dragAndDropContainerState === 'active')
    return `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='8' ry='8' stroke='%236C8080FF' stroke-width='2' stroke-dasharray='8' stroke-dashoffset='4' stroke-linecap='round'/%3e%3c/svg%3e")`;
  return `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='8' ry='8' stroke='%23B8CCCCFF' stroke-width='2' stroke-dasharray='8' stroke-dashoffset='4' stroke-linecap='round'/%3e%3c/svg%3e")`;
};

export const getAccordionSummaryStyles =
  (size: MediumSizeType, expanded: boolean): Sx =>
  (theme) => ({
    transition: 'padding-bottom 0.3s',
    padding: () => {
      if (size === 'lg') return theme.spacing(3, 6, expanded ? 4 : 8, 6);
      if (size === 'md') return theme.spacing(2.5, 5, expanded ? 2 : 6, 5);
      return theme.spacing(1.5, 4, expanded ? 1 : 3, 4);
    },
    '&:last-child': {
      paddingBottom: theme.spacing(2.5),
    },
  });

export const getAccordionContentStyles =
  (size: MediumSizeType): Sx =>
  (theme) => ({
    padding: () => {
      if (size === 'lg') return theme.spacing(0, 6, 8, 6);
      if (size === 'md') return theme.spacing(0, 5, 6, 5);
      return theme.spacing(0, 4, 4, 4);
    },
    '&:last-child': {
      paddingBottom: theme.spacing(2.5),
    },
  });

export const accordionTileStyles = (
  theme: Theme,
  size: MediumSizeType,
  isDragAndDropContainer: boolean,
  dragAndDropContainerState?: 'default' | 'active' | 'disabled',
) => {
  const disabledStyle: Sx = {
    opacity: 0.5,
    cursor: 'auto',
    pointerEvents: 'none',
  };

  const borderedStyle: Sx = {
    paddingBottom: getPaddingBottom(theme, size),
    boxShadow: 'none',
    borderRadius: 2,
    border: isDragAndDropContainer ? undefined : `1px solid ${theme.palette.Border.BorderPrimary}`,
    backgroundImage: getBackgroundImage(isDragAndDropContainer, dragAndDropContainerState),
  };

  const sizeLStyle: Sx = {
    borderRadius: 2,
    paddingBottom: getPaddingBottom(theme, size),
    boxShadow: 'none',
  };

  const alertStyle: Sx = {
    padding: 0,
  };

  return {
    disabledStyle,
    borderedStyle,
    alertStyle,
    sizeLStyle,
  };
};
