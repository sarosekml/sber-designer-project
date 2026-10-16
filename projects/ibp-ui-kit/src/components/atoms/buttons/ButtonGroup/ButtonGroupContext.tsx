import React from 'react';

import { ButtonGroupButtonContext, ButtonGroupButtonProps } from './ButtonGroup.types';

export const ButtonGroupContext = React.createContext<ButtonGroupButtonContext>({});

export const useButtonGroupContextProps = <T extends ButtonGroupButtonProps>(
  props: T,
): T & ButtonGroupButtonContext => {
  const contextProps = React.useContext(ButtonGroupContext);

  return {
    ...contextProps,
    ...props,
  };
};

ButtonGroupContext.displayName = 'ButtonGroupContext';
