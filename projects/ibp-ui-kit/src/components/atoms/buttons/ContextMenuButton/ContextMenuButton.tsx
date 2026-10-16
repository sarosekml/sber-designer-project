import React, { ReactNode, useCallback, useMemo, useState } from 'react';

import { getDataTestId, mergeSx, Sx } from '@/utils';

import { ContextMenu, ContextMenuItem } from '../../ContextMenu';
import { IconButton } from '../../IconButton';
import { SxBox } from '../../SxBox';
import { Button } from '../Button';
import { useButtonGroupContextProps } from '../ButtonGroup/ButtonGroupContext';

import { anchorMenuDefault, transformMenuDefault } from './ContextMenuButton.const';
import { getContextMenuButtonStyles } from './ContextMenuButton.styles';
import { ContextMenuButtonProps, ContextMenuButtonPropsButtonPreset } from './ContextMenuButton.types';

interface ContainerProps {
  children: ReactNode;
  showContainer: boolean;
  styles: Sx;
}

const Container = ({ children, showContainer, styles }: ContainerProps) => {
  if (showContainer) {
    return <SxBox sx={styles}>{children}</SxBox>;
  }
  return children;
};

export const ContextMenuButton = React.memo((mainProps: ContextMenuButtonProps) => {
  const mergedProps = useButtonGroupContextProps(mainProps);

  const {
    dataTestId,
    disabled = false,
    icon = 'MoreDots',
    size = 'lg',
    items,
    onSelectItem,
    isButtonDisabled,
    minWidth = 30,
    anchorMenu = anchorMenuDefault,
    transformMenu = transformMenuDefault,
    type = 'transparent',
    viewType = 'icon',
    onButtonClick,
    onBackdropClick,
    sx,
    isGrouped,
    isSelectedShown,
    ...props
  } = mergedProps;

  const styles = useMemo(() => mergeSx(getContextMenuButtonStyles({ disabled, type }), sx), [disabled, sx, type]);

  const [contextMenuList, setContextMenuList] = useState<HTMLElement | null>(null);

  const closeMenu = useCallback(() => setContextMenuList(null), []);

  const selectHandler = useCallback(
    (item: ContextMenuItem, e: React.SyntheticEvent<HTMLElement>) => {
      e.stopPropagation();
      onSelectItem(item);
      closeMenu();
    },
    [closeMenu, onSelectItem],
  );

  const handleClick = useCallback((element: HTMLElement) => setContextMenuList(element), []);

  const handleButtonClick = useCallback(
    (e: React.SyntheticEvent<HTMLElement>) => {
      e.stopPropagation();
      onButtonClick?.(e);
      handleClick(e.currentTarget);
    },
    [handleClick],
  );

  return (
    <Container styles={styles} showContainer={!isGrouped}>
      {viewType === 'icon' && (
        <IconButton
          name={icon}
          size={size}
          onClick={handleButtonClick}
          disabled={isButtonDisabled || disabled}
          dataTestId={getDataTestId(dataTestId, 'ContextMenuButton')}
          sx={styles}
        />
      )}
      {viewType === 'button' && (
        <Button
          startIcon={icon}
          size={size}
          onClick={handleButtonClick}
          disabled={isButtonDisabled || disabled}
          dataTestId={getDataTestId(dataTestId, 'ContextMenuButton')}
          type={type}
          sx={sx}
        >
          {(props as ContextMenuButtonPropsButtonPreset)?.label}
        </Button>
      )}

      <ContextMenu
        dataTestId={getDataTestId(dataTestId, 'ContextMenu')}
        items={items}
        minWidth={minWidth}
        contextMenuList={contextMenuList}
        closeMenu={closeMenu}
        selectHandler={selectHandler}
        size={size}
        anchorMenu={anchorMenu}
        transformMenu={transformMenu}
        onBackdropClick={onBackdropClick}
        isSelectedShown={isSelectedShown}
      />
    </Container>
  );
});

ContextMenuButton.displayName = 'ContextMenuButton';
