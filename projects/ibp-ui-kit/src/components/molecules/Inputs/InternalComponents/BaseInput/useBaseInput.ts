import { useCallback, useMemo, useState } from 'react';

import { BaseInputHookProps } from './BaseInput.types';

export const useBaseInput = ({ autoFocus }: BaseInputHookProps) => {
  const [focused, setFocused] = useState(autoFocus ?? false);
  const [hovered, setHovered] = useState(false);

  const onFocus = useCallback(() => setFocused(true), [setFocused]);
  const onBlur = useCallback(() => setFocused(false), [setFocused]);

  const onMouseEnter = useCallback(() => setHovered(true), []);
  const onMouseLeave = useCallback(() => setHovered(false), []);

  return useMemo(
    () => ({
      focused,
      hovered,
      onFocus,
      onBlur,
      onMouseEnter,
      onMouseLeave,
    }),
    [focused, hovered, onFocus, onBlur, onMouseEnter, onMouseLeave],
  );
};
