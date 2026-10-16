import React from 'react';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

import { theme } from '@/index';

import { Button } from './Button';
import { ButtonProps } from './Button.types';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Buttons/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    children: { control: 'text', name: 'label' },
    disabled: { control: 'boolean' },
    hasLoader: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    color: { control: 'radio' },
    form: { description: 'Form Id for submit html type', control: 'text' },

    className: { table: { disable: true } },
    onClick: { table: { disable: true } },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

const MainComponentOptionsTemplate = (args) => {
  type ButtonVisibleProps = Omit<ButtonProps, 'dataTestId'>;
  const parameters: {
    name: string;
    cells: [ButtonVisibleProps, ButtonVisibleProps, ButtonVisibleProps, ButtonVisibleProps];
  }[] = [
    {
      name: 'startIcon + children + endIcon ',
      cells: [{ size: 'lg' }, { size: 'md' }, { size: 'sm' }, { size: 'xs' }],
    },
    {
      name: 'startIcon + children + endIcon + disabled',
      cells: [
        { size: 'lg', disabled: true },
        { size: 'md', disabled: true },
        { size: 'sm', disabled: true },
        { size: 'xs', disabled: true },
      ],
    },
    {
      name: 'startIcon + children',
      cells: [
        { size: 'lg', endIcon: undefined },
        { size: 'md', endIcon: undefined },
        { size: 'sm', endIcon: undefined },
        { size: 'xs', endIcon: undefined },
      ],
    },
    {
      name: 'endIcon + children',
      cells: [
        { size: 'lg', startIcon: undefined },
        { size: 'md', startIcon: undefined },
        { size: 'sm', startIcon: undefined },
        { size: 'xs', startIcon: undefined },
      ],
    },
    {
      name: 'children',
      cells: [
        { size: 'lg', startIcon: undefined, endIcon: undefined },
        { size: 'md', startIcon: undefined, endIcon: undefined },
        { size: 'sm', startIcon: undefined, endIcon: undefined },
        { size: 'xs', startIcon: undefined, endIcon: undefined },
      ],
    },
    {
      name: 'endIcon',
      cells: [
        { size: 'lg', startIcon: undefined, children: null },
        { size: 'md', startIcon: undefined, children: null },
        { size: 'sm', startIcon: undefined, children: null },
        { size: 'xs', startIcon: undefined, children: null },
      ],
    },
    {
      name: 'startIcon',
      cells: [
        { size: 'lg', endIcon: undefined, children: null },
        { size: 'md', endIcon: undefined, children: null },
        { size: 'sm', endIcon: undefined, children: null },
        { size: 'xs', endIcon: undefined, children: null },
      ],
    },
    {
      name: 'startIcon + children + endIcon + hasLoader',
      cells: [
        { size: 'lg', hasLoader: true },
        { size: 'md', hasLoader: true },
        { size: 'sm', hasLoader: true },
        { size: 'xs', hasLoader: true },
      ],
    },
    {
      name: 'startIcon + children + hasLoader',
      cells: [
        { size: 'lg', endIcon: undefined, hasLoader: true },
        { size: 'md', endIcon: undefined, hasLoader: true },
        { size: 'sm', endIcon: undefined, hasLoader: true },
        { size: 'xs', endIcon: undefined, hasLoader: true },
      ],
    },
    {
      name: 'endIcon + children + hasLoader',
      cells: [
        { size: 'lg', startIcon: undefined, hasLoader: true },
        { size: 'md', startIcon: undefined, hasLoader: true },
        { size: 'sm', startIcon: undefined, hasLoader: true },
        { size: 'xs', startIcon: undefined, hasLoader: true },
      ],
    },
    {
      name: 'children + hasLoader',
      cells: [
        { size: 'lg', startIcon: undefined, endIcon: undefined, hasLoader: true },
        { size: 'md', startIcon: undefined, endIcon: undefined, hasLoader: true },
        { size: 'sm', startIcon: undefined, endIcon: undefined, hasLoader: true },
        { size: 'xs', startIcon: undefined, endIcon: undefined, hasLoader: true },
      ],
    },
    {
      name: 'endIcon + hasLoader',
      cells: [
        { size: 'lg', startIcon: undefined, children: null, hasLoader: true },
        { size: 'md', startIcon: undefined, children: null, hasLoader: true },
        { size: 'sm', startIcon: undefined, children: null, hasLoader: true },
        { size: 'xs', startIcon: undefined, children: null, hasLoader: true },
      ],
    },
    {
      name: 'startIcon + hasLoader',
      cells: [
        { size: 'lg', endIcon: undefined, children: null, hasLoader: true },
        { size: 'md', endIcon: undefined, children: null, hasLoader: true },
        { size: 'sm', endIcon: undefined, children: null, hasLoader: true },
        { size: 'xs', endIcon: undefined, children: null, hasLoader: true },
      ],
    },
  ];
  return (
    <table
      style={{
        fontSize: theme.typography.BodySStrongSmb.fontSize,
        borderSpacing: theme.spacing(4, 2),
        width: '100%',
      }}
    >
      <thead style={{ textAlign: 'center' }}>
        <tr>
          <th></th>
          <th>LG</th>
          <th>MD</th>
          <th>SM</th>
          <th>XS</th>
        </tr>
      </thead>

      <tbody style={{ verticalAlign: 'top' }}>
        {parameters.map((row) => (
          <tr key={row.name}>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.name}</td>
            {row.cells.map((cellProps, index) => (
              <td key={index}>
                <Button {...args} {...cellProps} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const ColorsTemplate = (args: ButtonProps) => {
  const colors: ButtonProps['color'][] = ['default', 'primary', 'secondary', 'info', 'error', 'warning', 'success'];
  return (
    <table
      style={{
        fontSize: theme.typography.BodySStrongSmb.fontSize,
        borderSpacing: theme.spacing(4, 2),
        width: '100%',
      }}
    >
      <thead style={{ textAlign: 'left' }}>
        <tr>
          <th />
          <th>default</th>
          <th>loader</th>
          <th>disabled</th>
        </tr>
      </thead>

      <tbody>
        {colors.map((color) => (
          <tr key={color}>
            <td style={{ fontWeight: 700, textTransform: 'capitalize', textAlign: 'right' }}>
              <p>{color}</p>
            </td>
            <td>
              <Button {...args} color={color} />
            </td>
            <td>
              <Button {...args} color={color} hasLoader />
            </td>
            <td>
              <Button {...args} color={color} disabled />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const TableButtonsTemplate: StoryFn = (args: ButtonProps) => {
  return (
    <table
      style={{
        fontSize: theme.typography.BodySStrongSmb.fontSize,
        borderSpacing: theme.spacing(0, 4),
        width: '100%',
      }}
    >
      <thead>
        <tr>
          <th></th>
          <th>Primary</th>
          <th>Secondary</th>
        </tr>
      </thead>

      <tbody style={{ verticalAlign: 'top' }}>
        <tr>
          <p style={{ fontWeight: 700 }}>Default</p>
          <td style={{ textAlign: 'center' }}>
            <Button {...args} color="primary" startIcon="FolderArrowForward" />
          </td>
          <td style={{ textAlign: 'center' }}>
            <Button {...args} color="secondary" startIcon="MinusCircle" />
          </td>
        </tr>

        <tr>
          <p style={{ fontWeight: 700 }}>Disabled</p>
          <td style={{ textAlign: 'center' }}>
            <Button {...args} color="primary" startIcon="FolderArrowForward" disabled />
          </td>
          <td style={{ textAlign: 'center' }}>
            <Button {...args} color="secondary" startIcon="MinusCircle" disabled />
          </td>
        </tr>

        <tr>
          <p style={{ fontWeight: 700 }}>Loader</p>
          <td style={{ textAlign: 'center' }}>
            <Button {...args} color="primary" hasLoader disabled />
          </td>
          <td style={{ textAlign: 'center' }}>
            <Button {...args} color="secondary" hasLoader disabled />
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение кнопки',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    type: 'accent',
    children: 'Click Me',
  },
};

export const Accent: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты отображения accent type кнопки',
      },
    },
  },
  args: {
    ...Main.args,
    children: 'Button',
    startIcon: 'Star',
    endIcon: 'Star',
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};

export const Outlined: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты отображения outlined type кнопки',
      },
    },
  },
  args: {
    ...Accent.args,
    type: 'outlined',
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};

export const Transparent: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты отображения transparent type кнопки',
      },
    },
  },
  args: {
    ...Accent.args,
    type: 'transparent',
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};

export const Colors: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты цветов для кнопок типа outline и transparent',
      },
    },
  },
  args: {
    ...Outlined.args,
    size: 'md',
  },
  render: (args) => <ColorsTemplate {...args} />,
};

export const TableButtons: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение кнопок в таблице',
      },
    },
  },
  args: {
    ...Outlined.args,
    size: 'sm',
  },
  render: (args) => <TableButtonsTemplate {...args} />,
};
