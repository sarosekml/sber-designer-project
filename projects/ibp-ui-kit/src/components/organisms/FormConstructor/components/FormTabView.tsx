import React, { memo, useMemo } from 'react';

import { Grid } from '@/components/atoms';
import { Text } from '@/components/atoms/typography';

import { FormComponentBaseProps } from '../FormConstructor.types';
import { getInputGridProps, nameToString } from '../FormConstructor.utils';

import { getNecessaryInput } from './FormFields.utils';

export interface FormTabViewComponentProps<T> extends FormComponentBaseProps<T> {
  currentTab: string;
}

export const FormTabViewComponent = <T,>({
  forms,
  currentTab,
  fromViewType,
  spacing = 4,
  dictionaries,
  alignItems,
}: FormTabViewComponentProps<T>) => {
  const tab = useMemo(() => forms.find((it) => it.tabKey === currentTab), [forms, currentTab]);

  if (!tab) return null;

  return (
    <Grid container key={tab.tabKey} spacing={spacing}>
      <Grid item xs={12}>
        <Text dataTestId={tab.tabKey} type={'BodyMStrongSmb'}>
          {tab.tabName}
        </Text>
      </Grid>
      {tab.fieldList.map((field) => {
        const gridProps = getInputGridProps(field);
        return (
          <Grid {...gridProps} key={nameToString(field.name)} alignItems={alignItems ?? 'flex-end'} display={'flex'}>
            {getNecessaryInput({ field, dictionaries, viewType: fromViewType, dataTestId: field.dataTestId })}
          </Grid>
        );
      })}
    </Grid>
  );
};

export const FormTabView = memo(FormTabViewComponent) as typeof FormTabViewComponent;
