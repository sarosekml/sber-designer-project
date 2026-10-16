import React, { memo, MouseEvent, useMemo } from 'react';
import { Chip, Grid } from '@mui/material';

import { doNothing, getDataTestId, mergeSx } from '@/utils';

import { Icon } from '../Icon';
import { Tooltip } from '../Tooltip';

import { useEllipsisMonitor } from './DictionaryBadge.hooks';
import { labelStyles, useStyles } from './DictionaryBadge.styles';
import { DictionaryBadgeProps } from './DictionaryBadge.types';

/**
 * Most of the time it's enough to use ValueBadge, if you have only value and
 * no need to use code in the click-callbacks, otherwise if you want to
 * show exactly the Dictionary dto you can use DictionaryBadge as:
 * @example
 * <DictionaryBadge component="Chip" {...dictionary}/>
 * @example
 * <ValueBadge component="Chip" value={someValue}/>
 */
export const DictionaryBadge = memo(
  ({
    code,
    name,
    variant = 'outlined',
    size = 'md',
    type = 'edit',
    colorThemeSx,
    dataTestId,
    disabled = false,
    active = false,
    onClick: onClickCallback,
    onDelete: onDeleteCallback,
    className,
    startIcon,
    endIcon,
    component,
    showContentTooltip = component === 'Marker',
    sx,
    containerSx,
    hoverable = Boolean(onDeleteCallback),
    tooltip,
  }: DictionaryBadgeProps) => {
    const { ref, isEllipsisActive } = useEllipsisMonitor();

    const hasDeleteButton = Boolean(onDeleteCallback);

    const hasPostfix = Boolean(endIcon) || hasDeleteButton;

    const styles = useStyles({
      variant,
      size,
      type,
      colorThemeSx,
      disabled,
      active,
      sx,
      hasDeleteButton,
      hoverable,
      component,
      hasPostfix,
    });

    const onClick = useMemo(() => {
      if (!onClickCallback) return undefined;
      return (e: MouseEvent) => {
        onClickCallback?.(
          {
            code,
            name: name,
          },
          e,
        );
      };
    }, [code, name, onClickCallback]);

    const onDelete = useMemo(() => {
      if (!onDeleteCallback) return undefined;
      return (e: MouseEvent) => {
        onDeleteCallback(
          {
            code,
            name: name,
          },
          e,
        );
      };
    }, [code, name, onDeleteCallback]);

    const label =
      showContentTooltip && !tooltip?.content ? (
        <Tooltip type="hint" title={name} dataTestId={'Chip_Tooltip'} disabled={!isEllipsisActive}>
          <Grid sx={labelStyles}>{name}</Grid>
        </Tooltip>
      ) : (
        name
      );

    const content = (
      <Chip
        key={code}
        ref={ref}
        className={className}
        data-testid={getDataTestId(dataTestId, 'DictionaryBadge')}
        sx={styles}
        disabled={disabled}
        icon={startIcon}
        deleteIcon={hasDeleteButton ? <Icon name={'Close'} /> : endIcon}
        onClick={onClick}
        onDelete={endIcon && !onDelete ? doNothing : onDelete}
        label={label}
      />
    );

    if (tooltip?.content) {
      return (
        <Grid item sx={mergeSx({ maxWidth: '100%', width: 'min-content' }, containerSx)}>
          <Tooltip type={'default'} title={tooltip?.content} dataTestId={'Chip_Tooltip'} placement="top">
            {content}
          </Tooltip>
        </Grid>
      );
    }

    return content;
  },
);

DictionaryBadge.displayName = 'DictionaryBadge';
