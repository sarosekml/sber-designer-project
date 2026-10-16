import React from 'react';
import { ThemeProvider } from '../src/components/atoms/Theme';
import { swamp } from '../src';
import { withScreenshot } from 'storycap';
import { Title, Description, Primary, Controls, Stories } from '@storybook/blocks';

const customViewports = {
  xs: {
    name: 'XS Phone',
    styles: {
      width: '480px',
      height: '600px',
    },
  },
  sm: {
    name: 'SM Tablet',
    styles: {
      width: '640px',
      height: '801px',
    },
  },
  md: {
    name: 'MD Big Tablet',
    styles: {
      width: '960px',
      height: '700px',
    },
  },
  lg: {
    name: 'LG Desktop small',
    styles: {
      width: '1200px',
      height: '800px',
    },
  },
  lp: {
    name: 'LP Macbook',
    styles: {
      width: '1440px',
      height: '900px',
    },
  },
  xl: {
    name: 'XL FullHD',
    styles: {
      width: '1920px',
      height: '900px',
    },
  },
};

/** @todo Add a text description for all components where(  viewMode: 'canvas') */
export const parameters = {
  actions: { argTypesRegex: '^on.*' },
  controls: { expanded: true },
  viewport: {
    viewports: customViewports,
  },
  backgrounds: {
    default: 'white',
    values: [
      { name: 'white', value: '#FFFFFF' },
      { name: 'light', value: '#F6F9FC' },
      { name: 'light swamp', value: swamp[100] },
      { name: 'dark', value: '#444A4A' },
    ],
  },
  docs: {
    page: () => (
      <>
        <Title />
        <Description />
        <Primary />
        <Controls />
        <Stories />
      </>
    ),
  },
};

export const decorators = [
  withScreenshot,
  (Story) => (
    <ThemeProvider>
      <Story />
    </ThemeProvider>
  ),
];
