/* eslint-disable @typescript-eslint/no-unused-vars */
import { StoryFn, Meta } from '@storybook/react';
import React from 'react';
import { Stepper } from './Stepper';
import { StepItem, subStepperTypeValues } from './Stepper.types';

const basicStepsArray: StepItem[] = [
  {
    active: false,
    completed: true,
    key: 'step1',
    title: 'Step 1',
    helperText: 'Step 1 helper text',
  },
  {
    active: true,
    completed: true,
    key: 'step2',
    title: 'Step 2',
  },
  {
    active: false,
    completed: false,
    key: 'step3',
    title: 'Step 3',
  },
  {
    active: false,
    completed: false,
    disabled: true,
    key: 'step4',
    title: 'Step 4',
  },
];
const twoLevelStepsArray = () => {
  const stepsArray = structuredClone(basicStepsArray);
  stepsArray[1].steps = [
    {
      active: false,
      completed: true,
      key: 'step21',
      title: 'Step 2.1',
    },
    {
      active: false,
      completed: false,
      key: 'step22',
      title: 'Step 2.2',
    },
    {
      active: false,
      completed: false,
      key: 'step23',
      title: 'Step 2.3',
    },
  ];
  return stepsArray;
};
const threeLevelStepsArray = () => {
  const stepsArray = structuredClone(twoLevelStepsArray());

  stepsArray[1].steps![1].steps = [
    {
      active: false,
      completed: true,
      key: 'step221',
      title: 'Step 2.2.1',
    },
    {
      active: false,
      completed: false,
      key: 'step222',
      title: 'Step 2.2.2',
    },
    {
      active: false,
      completed: false,
      key: 'step223',
      title: 'Step 2.2.3',
    },
  ];
  return stepsArray;
};

export default {
  title: 'Molecules/Steppers/Stepper',
  component: Stepper,
  argTypes: {
    dataTestId: {
      description: 'Stepper',
    },
    subStepperType: {
      options: subStepperTypeValues,
      control: { type: 'radio' },
    },
    outlined: {
      control: { type: 'boolean' },
    },
    readonly: {
      control: { type: 'boolean' },
    },
  },
  args: {
    outlined: false,
    readonly: false,
  },
  parameters: {
    docs: {
      description: {
        component: `There are two ways of using the component:
        1 - Just put steps array into steps attribute. The component will render stock view;
    2 - You can use custom step components with Stepper by putting them between opening and closing tags`,
      },
    },
  },
} as Meta;

const Template: StoryFn<typeof Stepper> = (args) => <Stepper {...args} />;

export const Main: StoryFn<typeof Stepper> = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  steps: basicStepsArray,
  orientation: 'vertical',
};

export const TwoLevelSteps: StoryFn<typeof Stepper> = Template.bind({});
TwoLevelSteps.args = {
  dataTestId: 'stories',
  steps: twoLevelStepsArray(),
  orientation: 'vertical',
};

export const ThreeLevelSteps: StoryFn<typeof Stepper> = Template.bind({});
ThreeLevelSteps.args = {
  dataTestId: 'stories',
  steps: threeLevelStepsArray(),
  orientation: 'vertical',
};

const corporateRequestStepsArray: StepItem[] = [
  {
    active: false,
    completed: true,
    key: 'step1',
    title: 'Черновик',
  },
  {
    active: true,
    completed: false,
    key: 'step2',
    title: 'В работе',
    steps: [
      {
        active: true,
        completed: true,
        key: 'step21',
        title: 'ЦУП',
      },
      {
        active: false,
        completed: false,
        key: 'step22',
        title: 'УСИ',
      },
      {
        active: false,
        completed: false,
        key: 'step23',
        title: 'ПАО',
      },
    ],
  },
  {
    active: false,
    completed: false,
    key: 'step3',
    title: 'Согласовано',
  },
];

export const WithSubStepperAsList: StoryFn<typeof Stepper> = Template.bind({});
WithSubStepperAsList.args = {
  dataTestId: 'stories',
  steps: corporateRequestStepsArray,
  orientation: 'vertical',
  subStepperType: 'arrowed',
};
