import React, { memo } from 'react';

import { Grid } from '@/components/atoms';

import { FormComponentBaseProps } from '../FormConstructor.types';
import { getInputGridProps, nameToString } from '../FormConstructor.utils';

import { getNecessaryInput } from './FormFields.utils';

export const FormNoTabViewComponent = <T,>({
  forms,
  fromViewType,
  spacing = 4,
  dictionaries,
  alignItems,
}: FormComponentBaseProps<T>) => {
  return (
    <Grid container spacing={spacing}>
      {forms.map((it) =>
        it.fieldList.map((field) => {
          const gridProps = getInputGridProps(field);
          return (
            <Grid
              item
              {...gridProps}
              key={nameToString(field.name)}
              alignItems={alignItems ?? 'flex-end'}
              display={'flex'}
            >
              {getNecessaryInput({ field, dictionaries, viewType: fromViewType, dataTestId: field.dataTestId })}
            </Grid>
          );
        }),
      )}
    </Grid>
  );
};

export const FormNoTabView = memo(FormNoTabViewComponent) as typeof FormNoTabViewComponent;
