import React, { memo, useCallback, useEffect, useState } from 'react';
import { Alert as MuiAlert, Collapse } from '@mui/material';

import { Grid, Icon, Text } from '@/components/atoms';
import { IconButton } from '@/components/atoms/IconButton';
import { getDataTestId } from '@/utils';

import { actionsContainerStyles, alertRootStyles, getAlertTitleStyles, getCollapseStyles } from './Alert.styles';
import { AlertProps } from './Alert.types';

export const Alert = memo<AlertProps>(
  ({
    severity = 'success',
    children,
    dataTestId,
    title = '',
    isOpen = false,
    onClose,
    expandable = true,
    actions,
    gridSizes = { xs: 12 },
  }) => {
    const [open, setOpen] = useState<boolean>(isOpen);
    const alertTitleStyles = getAlertTitleStyles({ hasTitle: !!title });
    const collapseStyles = getCollapseStyles({ isExpanded: open });

    useEffect(() => {
      if (!expandable) setOpen(true);
    }, [expandable]);

    const toggleCollapse = useCallback(() => {
      setOpen(!open);
    }, [open]);

    return (
      <Grid item container sizes={gridSizes}>
        <MuiAlert
          data-testid={getDataTestId(dataTestId, 'Alert')}
          severity={severity}
          sx={alertRootStyles}
          onClose={onClose}
          iconMapping={{
            error: <Icon name={'AlertCircle'} dataTestId={`Alert`} size={'inherit'} color={'inherit'} />,
            success: <Icon name={'CheckCircleFilled'} dataTestId={`Alert`} size={'inherit'} color={'success'} />,
            warning: <Icon name={'AlertTriangle'} dataTestId={`Alert`} size={'inherit'} color={'inherit'} />,
            info: <Icon name={'InfoCircleFilled'} dataTestId={`Alert`} size={'inherit'} color={'info'} />,
          }}
          action={
            <Grid sx={actionsContainerStyles}>
              {expandable && (
                <IconButton
                  name={open ? 'ChevronUp' : 'ChevronDown'}
                  dataTestId={'ExpandButton'}
                  size="lg"
                  onClick={toggleCollapse}
                  color={severity}
                />
              )}
              {onClose && (
                <IconButton
                  name={'Close'}
                  dataTestId={'IconButtonClose'}
                  size="lg"
                  onClick={onClose}
                  color={severity}
                />
              )}
            </Grid>
          }
        >
          <Text sx={alertTitleStyles}>{title}</Text>

          {(children || actions) && (
            <Collapse in={open} sx={collapseStyles}>
              {children}
              {actions && <Grid mt={2}>{actions}</Grid>}
            </Collapse>
          )}
        </MuiAlert>
      </Grid>
    );
  },
);

Alert.displayName = 'Alert';
