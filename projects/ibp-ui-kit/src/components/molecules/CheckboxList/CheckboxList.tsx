import React, { memo, useCallback, useMemo, useState } from 'react';
import { useTheme } from '@mui/material';

import { isEmpty } from '@sber-ibp/core';

import { Grid, Text } from '@/components/atoms';
import { getDataTestId } from '@/utils';

import { CheckboxListData, CheckboxListProps } from './CheckboxList.types';
import { isAllItemsSelected, isSelectedAtLeastOne } from './CheckboxList.utils';
import { CheckboxListRow } from './CheckboxListRow';

export const CheckboxList = memo(
  ({ checkboxSize = 'md', data, onChange, title, dataTestId, description }: CheckboxListProps) => {
    const theme = useTheme();

    const [currentData, setCurrentData] = useState(data);

    const isCheckedAtLeastOne = useMemo(() => currentData && isSelectedAtLeastOne(currentData), [currentData]);
    const isCheckedAll = useMemo(() => !!currentData && isAllItemsSelected(currentData), [currentData]);

    const onChangeInternal = useCallback(
      (checkboxId: string) => {
        if (!currentData || isEmpty(currentData)) return;

        const updatedCurrentData = currentData.map((it) =>
          checkboxId === it.id ? { ...it, checked: !it.checked } : it,
        );
        setCurrentData(updatedCurrentData);

        onChange?.(updatedCurrentData);
      },
      [onChange, currentData],
    );

    const onChangeAllDefault = useCallback(() => {
      if (!currentData || !Array.isArray(currentData)) return;

      const updatedCurrentData: CheckboxListData[] = currentData.map((it) => ({ ...it, checked: !isCheckedAll }));
      setCurrentData(updatedCurrentData);

      onChange?.(updatedCurrentData);
    }, [onChange, currentData, isCheckedAll]);

    return (
      <Grid container direction={'column'} dataTestId={getDataTestId(dataTestId, 'CheckboxList')}>
        {description && (
          <Grid item mb={2}>
            <Text type="BodyMReg" dataTestId={`${dataTestId}_description`} color={theme.palette.Text.TextSecondary}>
              {description}
            </Text>
          </Grid>
        )}
        <Grid item container direction={'column'}>
          <Grid item>
            <CheckboxListRow
              label={title}
              checked={isCheckedAll}
              indeterminate={isCheckedAtLeastOne && !isCheckedAll}
              onChange={onChangeAllDefault}
              checkboxSize={checkboxSize}
              isHeaderRow
              id={'tableHead'}
              dataTestId={'all'}
            />
          </Grid>
          <Grid item pt={2}>
            {currentData?.map((item) => (
              <Grid key={item.name}>
                <CheckboxListRow
                  key={item.label}
                  label={item.label}
                  checked={item.checked}
                  checkboxSize={checkboxSize}
                  onChange={onChangeInternal}
                  id={item.id}
                  name={item.name}
                  dataTestId={item.id}
                />
              </Grid>
            )) ?? null}
          </Grid>
        </Grid>
      </Grid>
    );
  },
);

CheckboxList.displayName = 'CheckboxList';
