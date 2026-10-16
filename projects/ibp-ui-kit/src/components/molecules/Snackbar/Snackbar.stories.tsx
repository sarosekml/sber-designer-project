import React, { useState } from 'react';
import Stack from '@mui/material/Stack';
import { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/atoms';

import { Snackbar } from './Snackbar';

const meta: Meta<typeof Snackbar> = {
  title: 'Molecules/Snackbar',
  component: Snackbar,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    isOpen: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof Snackbar>;

const MainTemplate = (args) => {
  const [open, setOpen] = useState<boolean>(false);

  const handleClick = () => {
    setOpen(true);
  };

  return (
    <Stack spacing={2} sx={{ width: '100%', height: '100px' }}>
      <Button dataTestId={'stories'} type="outlined" onClick={handleClick}>
        Open snackbar
      </Button>
      <Snackbar {...args} isOpen={open} onClose={() => setOpen(false)} />
    </Stack>
  );
};

export const Info: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Snackbar с информацией',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    message: 'Это уведомление можно прочитать одним глазком и закрыть',
    title: 'Глянь-ка',
    type: 'info',
    isOpen: false,
  },
  render: (args) => <MainTemplate {...args} />,
};

export const Success: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Snackbar успешной операции',
      },
    },
  },
  args: {
    ...Info.args,
    type: 'success',
  },
  render: (args) => <MainTemplate {...args} />,
};

export const Error: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Snackbar с ошибкой',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    message: 'А вот на это уведомление ты просто обязан отреагировать и принять к сведению',
    title: 'Ошибка',
    type: 'error',
    isOpen: false,
  },
  render: (args) => <MainTemplate {...args} />,
};

export const Warning: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Snackbar с предупреждением',
      },
    },
  },
  args: {
    message: 'Обрати внимание',
    title: 'Внимание',
    type: 'warning',
  },
  render: (args) => <MainTemplate {...args} />,
};

export const ExampleWithButton: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение кнопки-иконки',
      },
    },
  },
  args: {
    ...Info.args,
    action: (
      <Button dataTestId={'stories'} type={'outlined'} size={'xs'} color={'info'} onClick={() => console.log('action')}>
        Применить
      </Button>
    ),
  },
  render: (args) => <MainTemplate {...args} />,
};
