import React, { memo, ReactNode, useMemo } from 'react';

import { isEmpty } from '@sber-ibp/core';

import { Icon, IconName } from '@/components/atoms/Icon';
import { SxBox } from '@/components/atoms/SxBox';
import { Tooltip, TooltipProps } from '@/components/atoms/Tooltip';
import { DataTestIdProps, MediumSizeType } from '@/types/common.types';
import { Sx } from '@/utils';

import { baseInputActionsContainerStyles } from '../BaseInputStyles/BaseInput.styles';

export interface BaseInputActionsConfig extends DataTestIdProps {
  action?: () => void;
  icon: IconName;
  tooltipProps?: Omit<TooltipProps, 'children'>;
  size?: MediumSizeType;
  containerSx?: Sx;
  iconSx?: Sx;
  disabled?: boolean;
}

const isBaseInputActionsConfig = (item: BaseInputActionsConfig | ReactNode): item is BaseInputActionsConfig =>
  !!item && typeof item === 'object' && 'icon' in item;

export type BaseInputActionsItemType = BaseInputActionsConfig | ReactNode;

export interface BaseInputActionsProps {
  items?: BaseInputActionsItemType[];
}

const getIconComponent = (it: BaseInputActionsConfig) => {
  return <Icon name={it.icon} size={it.size} onClick={it.action} sx={it.iconSx} dataTestId={it.dataTestId} />;
};

const root = 'BaseInputActions';

export const BaseInputActions = memo(({ items }: BaseInputActionsProps) => {
  const preparedItems = useMemo(() => {
    if (!items || isEmpty(items)) return null;
    return items.map((it, index) => {
      if (isBaseInputActionsConfig(it)) {
        if (it.tooltipProps) {
          return (
            <SxBox key={index} sx={it.containerSx}>
              <Tooltip {...it.tooltipProps}>
                <SxBox>{getIconComponent(it)}</SxBox>
              </Tooltip>
            </SxBox>
          );
        } else {
          return (
            <SxBox key={index} sx={it.containerSx}>
              {getIconComponent(it)}
            </SxBox>
          );
        }
      } else {
        return <SxBox key={index}>{it}</SxBox>;
      }
    });
  }, [items]);

  return <SxBox sx={baseInputActionsContainerStyles}>{preparedItems}</SxBox>;
});

BaseInputActions.displayName = root;
