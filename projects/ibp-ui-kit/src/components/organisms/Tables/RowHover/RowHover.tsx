import React, { memo, useMemo } from 'react';

import { ContextMenuButton, ContextMenuItem, IconButton, SxBox, Tooltip } from '@/components/atoms';

import { hoverMenuItemSx, hoverTableSx } from './RowHover.styles';
import { RowHoverProps } from './RowHover.types';
import { RowHoverTemplate } from './RowHoverTemplate';

export const RowHoverComponent = <RowDataType extends object>({
  actions,
  rowColorSchema,
  stickTo = 'right',
  ...rowDefinition
}: RowHoverProps<RowDataType>) => {
  const hasDropDown = actions.length > 3;
  const visibleActions = useMemo(() => (hasDropDown ? actions.slice(0, 2) : actions), [actions, hasDropDown]);
  const dropDownActions = useMemo(
    () => (hasDropDown ? actions.slice(2, actions.length) : null),
    [actions, hasDropDown],
  );

  const dropDownItems: ContextMenuItem[] | undefined = useMemo(
    () =>
      dropDownActions?.map((action) => ({
        action: () => action.onClick?.(rowDefinition),
        isDisabled: action.isDisabled?.(rowDefinition),
        value: action.label,
      })),
    [dropDownActions, rowDefinition],
  );

  return (
    <RowHoverTemplate colorSchema={rowColorSchema} stickTo={stickTo}>
      <SxBox sx={hoverTableSx}>
        {visibleActions.map((action, index) => {
          return action.isHintTooltip ? (
            <SxBox key={index}>
              <Tooltip title={action.label} type={'hint'} placement={'top'}>
                <IconButton
                  name={action.icon}
                  onClick={() => action.onClick?.(rowDefinition)}
                  disabled={action.isDisabled?.(rowDefinition)}
                />
              </Tooltip>
            </SxBox>
          ) : (
            <SxBox key={index}>
              <IconButton
                name={action.icon}
                title={action.label}
                onClick={() => action.onClick?.(rowDefinition)}
                disabled={action.isDisabled?.(rowDefinition)}
              />
            </SxBox>
          );
        })}

        {dropDownItems ? (
          <SxBox sx={hoverMenuItemSx}>
            <ContextMenuButton items={dropDownItems} icon={'MoreDots'} onSelectItem={(item) => item.action?.()} />
          </SxBox>
        ) : null}
      </SxBox>
    </RowHoverTemplate>
  );
};

export const RowHover = memo(RowHoverComponent) as typeof RowHoverComponent & { displayName: string };
RowHover.displayName = 'RowHover';
