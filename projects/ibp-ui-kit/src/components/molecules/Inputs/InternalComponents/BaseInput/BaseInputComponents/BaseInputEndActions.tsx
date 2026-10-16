import React, { memo, MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { InputAdornment, useTheme } from '@mui/material';

import { isEmpty } from '@sber-ibp/core';

import { Icon, SxBox } from '@/components/atoms';
import { DataTestIdProps } from '@/types/common.types';
import { mergeSx } from '@/utils/mergeSx';

import { BaseInputActionOptions, BaseInputProps } from '../BaseInput.types';
import { baseInputIconColorStyles } from '../BaseInputStyles/BaseInput.styles';
import { actionsIndentSizes, iconHoverStyles, prefixPostfixStyles } from '../BaseInputStyles/BaseInputActions.styles';

import { BaseInputActions, BaseInputActionsConfig, BaseInputActionsItemType } from './BaseInputActions';

/**
 * Component for BaseInput actions in the end of input with postfix
 * */
export interface BaseInputEndActionsProps
  extends Pick<BaseInputProps, 'size' | 'onClear' | 'onInfo' | 'disabled' | 'postfix' | 'infoOptions' | 'value'>,
    DataTestIdProps {
  /**
   * Open autocomplete or any drop down items
   */
  onOpen?: () => void;
  /**
   * Close autocomplete or any drop down items
   */
  onClose?: () => void;
  /**
   * Opened state of the dropdown element
   */
  isOpened?: boolean;
  /**
   * Get postfix ref upper component
   * */
  getPostfixRef?: (postfixRef: MutableRefObject<HTMLDivElement | null>) => void;
  hasClearIndicator?: boolean;
  endAction?: BaseInputActionOptions;
}

const root = 'BaseInputEndActions';

export const BaseInputEndActions = memo(
  ({
    size = 'md',
    disabled,
    onInfo,
    postfix,
    onClear,
    infoOptions,
    dataTestId,
    isOpened,
    onOpen,
    onClose,
    getPostfixRef: getPostfixRef,
    value,
    endAction,
    hasClearIndicator = true,
  }: // eslint-disable-next-line sonarjs/cognitive-complexity
  BaseInputEndActionsProps) => {
    const theme = useTheme();
    const postfixStyles = prefixPostfixStyles(size);
    const postfixRef = useRef<HTMLDivElement | null>(null);
    const showClearIcon = Boolean(onClear && !disabled && value && hasClearIndicator);

    useEffect(() => {
      if (!postfixRef.current || !getPostfixRef) return;
      getPostfixRef(postfixRef);
    }, [getPostfixRef]);

    const items = useMemo<BaseInputActionsItemType[]>(() => {
      const result: BaseInputActionsItemType[] = [];
      const postFixIsLast = !showClearIcon && !onInfo && !!postfix;
      const clearIconIsLast = showClearIcon && !onInfo;
      const onInfoIsLast = !onOpen && !onClose && !!onInfo;
      if (postfix) {
        result.push(
          <SxBox
            component={'div'}
            ref={postfixRef}
            sx={mergeSx(postfixStyles, { mr: postFixIsLast ? 0 : theme.spacing(2) })}
          >
            {postfix}
          </SxBox>,
        );
      }
      if (showClearIcon) {
        result.push(
          <Icon
            name={'Close'}
            dataTestId="ClearAction"
            size={size}
            onClick={disabled ? undefined : onClear}
            sx={mergeSx(baseInputIconColorStyles({ disabled }), iconHoverStyles({ disabled }), {
              mr: clearIconIsLast ? 0 : theme.spacing(actionsIndentSizes[size]),
            })}
          />,
        );
      }
      if (onInfo || infoOptions?.tooltipValue) {
        const infoProps: BaseInputActionsConfig = {
          action: onInfo,
          icon: 'InfoCircle',
          dataTestId: 'InfoAction',
          tooltipProps: {
            placement: 'top',
            arrow: 'bottom',
            title: infoOptions?.tooltipValue,
          },
          size,
          containerSx: { mr: onInfoIsLast ? 0 : theme.spacing(2) },
          iconSx: mergeSx(baseInputIconColorStyles({ disabled: false }), iconHoverStyles({ disabled: false })),
        };
        result.push(infoProps);
      }
      if (onOpen && onClose) {
        const openCloseProps: BaseInputActionsConfig = {
          icon: isOpened ? 'PointerUp' : 'PointerDown',
          dataTestId: 'ToggleAction',
          size,
          action: isOpened ? onClose : onOpen,
          iconSx: mergeSx(baseInputIconColorStyles({ disabled }), iconHoverStyles({ disabled })),
        };
        result.push(openCloseProps);
      }
      if (endAction) {
        result.push({
          icon: endAction.iconName,
          dataTestId: 'EndAction',
          size,
          action: disabled ? undefined : endAction.onStartAction,
          containerSx: { ml: theme.spacing(2) },
          iconSx: mergeSx(baseInputIconColorStyles({ disabled }), iconHoverStyles({ disabled })),
        });
      }
      return result;
    }, [
      disabled,
      infoOptions?.tooltipValue,
      isOpened,
      endAction,
      onClear,
      onClose,
      onInfo,
      onOpen,
      postfix,
      postfixStyles,
      showClearIcon,
      size,
      theme,
    ]);

    return isEmpty(items) ? null : (
      <InputAdornment position={'end'} data-testid={dataTestId ? root + '_' + dataTestId : root}>
        <BaseInputActions items={items} />
      </InputAdornment>
    );
  },
);
BaseInputEndActions.displayName = root;
