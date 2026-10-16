/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Step, StepConnector, Stepper as MuiStepper } from '@mui/material';

import { SxBox } from '@/components/atoms/SxBox';
import { Text } from '@/components/atoms/typography';
import { getDataTestId } from '@/utils';

import { StepLabel } from '../StepLabel/StepLabel';

import {
  getStepLabelCustomStyles,
  muiStepperStyles,
  stepConnectorStyles,
  subStepperWrapperStyles,
} from './Stepper.styles';
import { PropTypes, StepItem, SubStepperProps } from './Stepper.types';

const SubStepper: FC<SubStepperProps> = React.memo(
  ({
    children,
    connectorLength = 8,
    dataTestId,
    orientation = 'vertical',
    steps = [],
    title,
    onStepHandler,
    readonly,
    subStepperType = 'checkmark',
  }) => (
    <>
      <SxBox sx={{ pb: 2 }}>
        <Text dataTestId={'SubStepper_Title'}>{title}</Text>
      </SxBox>
      <SxBox sx={subStepperWrapperStyles}>
        {children && !steps.length && (
          <Stepper
            readonly={readonly}
            connectorLength={connectorLength}
            dataTestId={getDataTestId(dataTestId, 'SubStepper')}
            orientation={orientation}
          >
            {children}
          </Stepper>
        )}
        {!children && !!steps.length && (
          <Stepper
            readonly={readonly}
            connectorLength={6}
            dataTestId={getDataTestId(dataTestId, 'SubStepper')}
            orientation={orientation}
            steps={steps}
            onStepHandler={onStepHandler}
            subStepperType={subStepperType}
          />
        )}
      </SxBox>
    </>
  ),
);

SubStepper.displayName = 'SubStepper';

export const Stepper: FC<PropTypes> = React.memo(
  ({
    children,
    connectorLength = 8,
    dataTestId,
    orientation = 'vertical',
    outlined,
    readonly = false,
    steps = [],
    onStepHandler,
    subStepperType = 'checkmark',
  }) => {
    const [internalSteps, setInternalSteps] = useState(steps);
    const hasNestedSteps = internalSteps.some((step) => !!step.steps?.length);

    const shouldRenderAsArrowed = !hasNestedSteps && subStepperType === 'arrowed';

    const muiStepperStyle = useMemo(
      () => muiStepperStyles({ outlined, shouldRenderAsArrowed }),
      [outlined, shouldRenderAsArrowed],
    );
    const connectorStyle = useMemo(
      () =>
        stepConnectorStyles({
          length: connectorLength,
          orientation,
        }),
      [connectorLength, orientation],
    );

    useEffect(() => setInternalSteps(steps), [steps]);

    const onResetActiveStep = (steps: StepItem[], currentStep: StepItem) => {
      return steps.reduce((acc: StepItem[], step: StepItem) => {
        step.active = currentStep.key === step.key;
        if (step.steps?.length) {
          step.steps = onResetActiveStep(step.steps, currentStep);
        }
        return [...acc, step];
      }, []);
    };

    const onStepClick = useCallback(
      (currentStep: StepItem) => {
        currentStep.onClick?.();
        setInternalSteps(onResetActiveStep(internalSteps, currentStep));
      },
      [internalSteps, onResetActiveStep],
    );

    const renderSubsteps = useCallback(
      (title: string, substeps: StepItem[]): JSX.Element => (
        <SubStepper
          readonly={readonly}
          connectorLength={connectorLength}
          dataTestId={dataTestId}
          orientation={orientation}
          outlined={outlined}
          steps={substeps}
          title={title}
          subStepperType={subStepperType}
        >
          {children}
        </SubStepper>
      ),
      [children, connectorLength, dataTestId, orientation, outlined, readonly, subStepperType],
    );

    return useMemo(() => {
      if (!!internalSteps.length && !children)
        return (
          <MuiStepper
            data-testid={getDataTestId(dataTestId, 'Stepper')}
            sx={muiStepperStyle}
            orientation={orientation}
            connector={shouldRenderAsArrowed ? null : <StepConnector data-testid="Connector" sx={connectorStyle} />}
          >
            {internalSteps?.map((step) => (
              <Step
                key={step.key}
                onClick={() => {
                  !readonly && !step.disabled && !step.steps?.length && (onStepHandler?.(step) || onStepClick(step));
                }}
              >
                {step.steps?.length ? (
                  renderSubsteps(step.title, step.steps)
                ) : (
                  <StepLabel
                    active={step.active}
                    completed={step.completed}
                    dataTestId={`${dataTestId}_${step.key}`}
                    disabled={step.disabled}
                    helperText={step.helperText}
                    stepperType={!hasNestedSteps ? subStepperType : 'checkmark'}
                    sx={getStepLabelCustomStyles(shouldRenderAsArrowed, step.active)}
                  >
                    {step.title}
                  </StepLabel>
                )}
              </Step>
            ))}
          </MuiStepper>
        );
      return (
        <MuiStepper
          data-testid={getDataTestId(dataTestId, 'Stepper')}
          orientation={orientation}
          sx={muiStepperStyle}
          connector={<StepConnector data-testid="Connector" sx={connectorStyle} />}
        >
          {children}
        </MuiStepper>
      );
    }, [
      children,
      connectorStyle,
      dataTestId,
      hasNestedSteps,
      internalSteps,
      muiStepperStyle,
      onStepClick,
      onStepHandler,
      orientation,
      readonly,
      renderSubsteps,
      shouldRenderAsArrowed,
      subStepperType,
    ]);
  },
);

Stepper.displayName = 'Stepper';
