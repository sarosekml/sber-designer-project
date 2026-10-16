import { useMemo } from 'react';

import { cssImportant, mergeSx,Sx } from '@/utils';

interface StyleProps {
  useTopPadding?: boolean;
  sx?: Sx;
}

const getDialogContentStyles =
  ({ useTopPadding, sx }: StyleProps): Sx =>
  (theme) => {
    const sxPt = sx && 'pt' in sx ? Number(sx?.pt) : undefined;
    const sxPaddingTop = sx && 'paddingTop' in sx ? Number(sx?.paddingTop) : undefined;

    const topPadding = sxPt ?? sxPaddingTop ?? 4;

    return {
      px: theme.spacing(6),
      pb: theme.spacing(4),

      /** @todo if MUI-material version is updated to be more than 5 check if this bug has gone and `cssImportant` is still needed */
      pt: useTopPadding ? cssImportant(theme.spacing(topPadding)) : undefined,
    };
  };

export const useDialogContentStyles = ({ useTopPadding, sx }: StyleProps): Sx =>
  useMemo(() => {
    return mergeSx(getDialogContentStyles({ useTopPadding, sx }), sx);
  }, [useTopPadding, sx]);
