import React, { useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { Button, FloatingButton } from '@/components/atoms/buttons';

import { Icon, SxBox } from '../../../atoms';

import { FloatingDialog } from './FloatingDialog';

export default {
  title: 'Molecules/FloatingDialog',
  component: FloatingDialog,
  argTypes: {
    alertProps: { table: { disable: true } },
    closeModal: { table: { disable: true } },
    dataTestId: { table: { disable: true } },
    dialogContentClassName: { table: { disable: true } },
    disabledCloseButton: { control: 'boolean', defaultValue: false },
    fullScreen: { control: 'boolean', defaultValue: false },
    name: { table: { disable: true } },
    titleColor: { table: { disable: true } },
    visible: { control: 'boolean', defaultValue: true },
    sx: {
      description:
        'Use `sx` property to style overall Modal window with props like maxHeight (with height `100%` applied to Modal), background color, etc',
    },
    useTopPadding: {
      description: 'Use it as `true` if needed that ModalContent always had upper padding',
      control: 'boolean',
    },
  },
} as Meta<typeof FloatingDialog>;

const Template: StoryFn<typeof FloatingDialog> = (args) => {
  const [isVisible, setVisible] = useState(false);
  const onClose = () => {
    setVisible(false);
  };
  return (
    <SxBox sx={{ width: '100%', height: '80vh', display: 'flex', alignItems: 'flex-end', justifyContent: 'end' }}>
      {isVisible ? null : (
        <FloatingButton variant="circular" dataTestId={'test'} onClick={() => setVisible(true)}>
          <Icon name="Check" color="white" />
        </FloatingButton>
      )}
      {isVisible ? (
        <FloatingDialog
          {...args}
          closeDialog={onClose}
          actions={
            <Button dataTestId="ModalButton" onClick={onClose}>
              Close
            </Button>
          }
        >
          A lot of content a lot of content a lot of content a lot of content a lot of content a lot of content a lot of
          content a lot of content a lot of content a lot of content a lot of content a lot of content a lot of content
          a lot of content a lot of content a lot of content a lot of content a lot of content a lot of content a lot of
          content a lot of content a lot of content a lot of content.
        </FloatingDialog>
      ) : null}
    </SxBox>
  );
};

export const Main: StoryFn<typeof FloatingDialog> = Template.bind({});
Main.args = {
  height: '400px',
  width: '600px',
  dataTestId: 'TestFloatingDialog',
  title: 'Testing floating dialog',
  alertTopProps: {
    severity: 'info',
    message: 'Дата внесений изменений, должна быть больше 2022-10-05',
    dataTestId: 'TestAlert',
  },
  alertBottomProps: {
    severity: 'success',
    title: 'Сумма платежа отражена полностью',
  },
  contentSx: { pt: 2, pb: 6 },
};

export const DialogWithSxStyles: StoryFn<typeof FloatingDialog> = Template.bind({});
DialogWithSxStyles.args = {
  height: '100%',
  width: '500px',
  dataTestId: 'StyledModal',
  title: 'Testing modal sx styling',
  contentSx: { pt: 2, pb: 6 },
  sx: { maxHeight: 700 },
};
