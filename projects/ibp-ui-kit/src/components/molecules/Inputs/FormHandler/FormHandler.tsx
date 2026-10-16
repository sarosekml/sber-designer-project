import React, { memo, useRef } from 'react';
import { FormProvider } from 'react-hook-form';

import { SxBox } from '@/components/atoms/SxBox';
import { Sx } from '@/utils';

import { FormScroller } from './FormScroller/FormScroller';
import { defaultFormHandlerContextData, FormHandlerContext } from './FormHandler.context';
import { FormHandlerProps } from './FormHandler.types';
import { findElementByName } from './FormHandler.utils';

export const formStyles: Sx = { width: '100%', margin: 0 };

const root = 'FormHandler';

const FormHandlerComponent = <Data extends object>({
  children,
  methods,
  formId,
  onSubmit,
  onBlur,
  dataTestId,
  scrollToErrors = true,
  ...props
}: FormHandlerProps<Data>): JSX.Element => {
  const rootRef = useRef<HTMLElement>();

  return (
    <FormProvider {...methods}>
      <FormHandlerContext.Provider value={props ?? defaultFormHandlerContextData}>
        <SxBox
          component={'form'}
          sx={formStyles}
          onSubmit={onSubmit ? methods.handleSubmit(onSubmit) : undefined}
          id={formId}
          onBlur={onBlur ? methods.handleSubmit(onBlur) : undefined}
          data-testid={dataTestId ? dataTestId + '_' + root : root}
          ref={rootRef}
        >
          {scrollToErrors ? (
            <FormScroller onFindElement={(names) => findElementByName(names, rootRef.current)}>{children}</FormScroller>
          ) : (
            children
          )}
        </SxBox>
      </FormHandlerContext.Provider>
    </FormProvider>
  );
};

FormHandlerComponent.displayName = root;
export const FormHandler = memo(FormHandlerComponent) as typeof FormHandlerComponent;
