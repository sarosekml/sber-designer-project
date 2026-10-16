import React, { memo, MutableRefObject } from 'react';

import { Grid } from '@/components/atoms';
import { Text } from '@/components/atoms/typography';

import { FormComponentBaseProps } from '../FormConstructor.types';
import { getInputGridProps, nameToString } from '../FormConstructor.utils';

import { getNecessaryInput } from './FormFields.utils';

interface FormCompartmentAnchorViewComponentProps<T> extends FormComponentBaseProps<T> {
  tabMap: MutableRefObject<Map<any, any>>;
}

export const FormCompartmentAnchorViewComponent = <T,>({
  forms,
  tabMap,
  fromViewType,
  spacing = 4,
  dictionaries,
  alignItems,
}: FormCompartmentAnchorViewComponentProps<T>) => {
  return (
    <>
      {forms.map((it, index) => (
        <Grid container key={it.tabKey} spacing={spacing}>
          <Grid item xs={12} mt={index === 0 ? 0 : 8} id={it.tabKey}>
            <div
              ref={(elem: HTMLDivElement) => {
                tabMap.current.set(it.tabKey, elem);
              }}
            >
              <Text dataTestId={it.tabKey} type={'BodyMStrongSmb'}>
                {it.tabName}
              </Text>
            </div>
          </Grid>
          {it.fieldList.map((field) => {
            const gridProps = getInputGridProps(field);
            return (
              <Grid
                {...gridProps}
                key={nameToString(field.name)}
                alignItems={alignItems ?? 'flex-end'}
                display={'flex'}
              >
                {getNecessaryInput({ field, dictionaries, viewType: fromViewType, dataTestId: field.dataTestId })}
              </Grid>
            );
          })}
        </Grid>
      ))}
    </>
  );
};

export const FormCompartmentAnchorView = memo(
  FormCompartmentAnchorViewComponent,
) as typeof FormCompartmentAnchorViewComponent;
