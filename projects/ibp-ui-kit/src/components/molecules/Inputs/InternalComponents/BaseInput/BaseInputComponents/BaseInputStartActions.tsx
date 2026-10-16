import React, { memo, useMemo } from 'react';
import { InputAdornment, useTheme } from '@mui/material';

import { isEmpty } from '@sber-ibp/core';

import { SxBox } from '@/components/atoms/SxBox';
import { DataTestIdProps } from '@/types/common.types';
import { mergeSx } from '@/utils/mergeSx';

import { BaseInputProps } from '../BaseInput.types';
import { baseInputIconColorStyles } from '../BaseInputStyles/BaseInput.styles';
import { iconHoverStyles, prefixPostfixStyles } from '../BaseInputStyles/BaseInputActions.styles';

import { BaseInputActions, BaseInputActionsItemType } from './BaseInputActions';

/**
 * Component for BaseInput actions in the start of input with prefix
 * */
type BaseInputStartActionsProps = Pick<BaseInputProps, 'size' | 'startAction' | 'prefix' | 'disabled'> &
  DataTestIdProps;

const root = 'BaseInputStartActions';

export const BaseInputStartActions = memo(
  ({ size = 'md', disabled, prefix, dataTestId, startAction }: BaseInputStartActionsProps) => {
    const prefixStyles = prefixPostfixStyles(size);
    const theme = useTheme();

    const items = useMemo<BaseInputActionsItemType[]>(() => {
      const result: BaseInputActionsItemType[] = [];
      if (startAction) {
        result.push({
          icon: startAction.iconName,
          dataTestId: 'StartAction',
          size,
          action: disabled ? undefined : startAction.onStartAction,
          containerSx: { mr: prefix ? theme.spacing(2) : 0 },
          iconSx: mergeSx(baseInputIconColorStyles({ disabled }), iconHoverStyles({ disabled })),
        });
      }
      if (prefix) {
        result.push(<SxBox sx={prefixStyles}>{prefix}</SxBox>);
      }
      return result;
    }, [startAction, prefix, size, disabled, theme, prefixStyles]);

    return isEmpty(items) ? null : (
      <InputAdornment position={'start'} data-testid={dataTestId ? root + '_' + dataTestId : root}>
        <BaseInputActions items={items} />
      </InputAdornment>
    );
  },
);
BaseInputStartActions.displayName = root;
