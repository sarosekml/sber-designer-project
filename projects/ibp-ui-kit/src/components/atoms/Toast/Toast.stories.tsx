import { Meta, StoryFn } from '@storybook/react';
import { Toast } from './Toast';
import { Button } from '../buttons';
import React, { useState } from 'react';

export default {
  title: 'Atoms/Toast',
  component: Toast,
  parameters: {},
  argTypes: {
    dataTestId: { table: { disable: true } },
    ref: { table: { disable: true } },
    onClose: { table: { disable: true } },
    isOpen: { table: { disable: true } },
    blurBackground: { control: 'boolean' },
    showLoader: { control: 'boolean' },
  },
} as Meta;

const Template: StoryFn<typeof Toast> = (args) => {
  const [open, setOpen] = useState<boolean>(false);

  const handleClick = () => {
    setOpen(true);
  };

  return (
    <>
      <Button dataTestId={'stories'} type="outlined" onClick={handleClick}>
        Открыть уведомление
      </Button>
      <Toast {...args} isOpen={open} autoHideDuration={3000} onClose={() => setOpen(false)} />
    </>
  );
};

export const ToastNotification = Template.bind({});
ToastNotification.args = {
  message: 'Выполняется маршрутизация',
};
