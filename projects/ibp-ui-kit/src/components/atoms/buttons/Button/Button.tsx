import React, { memo, useMemo } from 'react';
import { Button as MuiButton } from '@mui/material';

import { Icon } from '@/components/atoms/Icon';
import { Loader } from '@/components/atoms/loaders';
import { SizeType } from '@/types';
import { mergeSx } from '@/utils/mergeSx';

import { Text } from '../../typography';
import { useButtonGroupContextProps } from '../ButtonGroup/ButtonGroupContext';

import { fontVariants } from './Button.const';
import {
  getButtonAccentStyles,
  getButtonIconStyles,
  getButtonOutlinedStyles,
  getButtonRootStyles,
  getButtonTransparentStyles,
} from './Button.styles';
import { ButtonProps, ButtonStyledProps } from './Button.types';
import { getContentVariant } from './Button.utils';

/**
 * [MuiButton API](https://mui.com/api/button/)
 *
 * [MuiButtons Demo](https://mui.com/material-ui/react-button/)
 *
 * @param className - for override styles externally (deprecated)
 *
 * @param children
 *
 * @param type - 'outlined' | 'accent' | 'transparent'
 *
 * @param disabled
 *
 * @param onClick
 *
 * @param startIcon - show icon before button text
 *
 * @param endIcon - show icon after button text
 *
 * @param size - 'xs' | 'sm' | 'md' | 'lg' (default 'md')
 *
 * @param htmlType - 'submit' | 'button' | 'reset'
 *
 * @param fullWidth
 * *
 * @param form - html prop for forms
 */
export const Button = memo<ButtonProps>((props) => {
  const mergedProps = useButtonGroupContextProps(props);

  const {
    className,
    children,
    color = 'default',
    disabled,
    onClick,
    size = 'md',
    type = 'accent',
    startIcon,
    endIcon,
    htmlType = 'button',
    form,
    fullWidth = false,
    dataTestId,
    id,
    sx,
    hasLoader = false,
  } = mergedProps;

  const { mergedStyles, styledProps } = useMemo(() => {
    const contentVariant = getContentVariant(!!children, !!startIcon, !!endIcon, hasLoader);
    const styledProps: ButtonStyledProps = {
      color,
      fullWidth,
      size,
      type,
      contentVariant,
      hasChildren: !!children,
      hasLoader,
    };
    const mergedStyles = mergeSx(
      getButtonRootStyles(styledProps),
      type === 'accent' && getButtonAccentStyles(),
      type === 'outlined' && getButtonOutlinedStyles(styledProps),
      type === 'transparent' && getButtonTransparentStyles(styledProps),
      sx,
    );
    return { mergedStyles, styledProps };
  }, [sx, color, fullWidth, size, type, children, startIcon, endIcon, hasLoader]);

  const iconStyles = getButtonIconStyles(styledProps);
  const buttonDataTestId = `${dataTestId}_Button`;

  const getLoader = (position: 'startIcon' | 'endIcon') => (
    <Loader
      dataTestId={dataTestId}
      size={styledProps.size as SizeType}
      color={styledProps.type === 'accent' ? 'white' : 'disabled'}
      sx={mergeSx({ width: 'min-content' }, iconStyles[position])}
      className={'Button__loader'}
    />
  );

  const buttonView = useMemo(() => {
    if (hasLoader) {
      return (
        <>
          {endIcon && children && !startIcon ? null : getLoader('startIcon')}
          {children && (
            <Text key="text" type={fontVariants[size]} dataTestId={buttonDataTestId}>
              {children}
            </Text>
          )}
          {endIcon && children && !startIcon && getLoader('endIcon')}
        </>
      );
    }

    return (
      <>
        {startIcon && <Icon key="startIcon" name={startIcon} sx={mergeSx(iconStyles.root, iconStyles.startIcon)} />}
        {children && (
          <Text key="text" type={fontVariants[size]} dataTestId={buttonDataTestId}>
            {children}
          </Text>
        )}
        {endIcon && <Icon key="endIcon" name={endIcon} sx={mergeSx(iconStyles.root, iconStyles.endIcon)} />}
      </>
    );
  }, [hasLoader, startIcon, endIcon, children, getLoader]);

  return (
    <MuiButton
      id={id}
      data-testid={buttonDataTestId}
      disabled={disabled || hasLoader}
      disableRipple
      onClick={onClick}
      form={form}
      className={className}
      type={htmlType}
      fullWidth={fullWidth}
      sx={mergedStyles}
    >
      {buttonView}
    </MuiButton>
  );
});

Button.displayName = 'Button';
