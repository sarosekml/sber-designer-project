import React from 'react';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/atoms/buttons';

import { Modal } from './Modal';

const meta: Meta<typeof Modal> = {
  title: 'Molecules/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Кнопка-иконка',
      },
    },
  },
  argTypes: {
    visible: { control: 'boolean' },
    fullScreen: { control: 'boolean' },
    disabledCloseButton: { control: 'boolean' },
    title: { control: 'text' },
    height: { control: 'text' },
    width: { control: 'text' },
    sx: {
      description:
        'Use `sx` property to style overall Modal window with props like maxHeight (with height `100%` applied to Modal), background color, etc',
    },
    useTopPadding: {
      description: 'Use it as `true` if needed that ModalContent always had upper padding',
      control: 'boolean',
    },
  },
};
export default meta;
type Story = StoryObj<typeof Modal>;

const MainTemplate = (args) => {
  const [_, updateArgs] = useArgs();
  const onClose = () => {
    updateArgs({ visible: false });
  };

  return (
    <>
      <Button dataTestId={'test'} onClick={() => updateArgs({ visible: true })}>
        Open Modal
      </Button>
      <Modal
        {...args}
        actions={
          <>
            <Button
              dataTestId="ModalButton"
              type={'transparent'}
              onClick={() => updateArgs({ fullScreen: !args.fullScreen })}
            >
              fullScreen
            </Button>
            <Button dataTestId="ModalButton">Save</Button>
          </>
        }
        closeModal={onClose}
      >
        Content
      </Modal>
    </>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение Modal',
      },
    },
  },
  args: {
    height: '300px',
    width: '600px',
    name: 'TestModal',
    title: 'Testing modal window',
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
    visible: false,
    fullScreen: false,
  },
  render: (args) => MainTemplate(args),
};

export const ModalWithSxStyles: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Modal со стилями',
      },
    },
  },
  args: {
    ...Main.args,
    height: '100%',
    width: '500px',
    title: 'Testing modal sx styling',
    useTopPadding: true,
    sx: { maxHeight: 700 },
  },
  render: (args) => MainTemplate(args),
};

export const ModalWithTopPaddingOnDialog: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Modal со стилями',
      },
    },
  },
  args: {
    ...ModalWithSxStyles.args,
    title: 'Testing modal with always use customized top padding for content field',
    contentSx: { pt: 6, pb: 6 },
  },
  render: (args) => MainTemplate(args),
};
