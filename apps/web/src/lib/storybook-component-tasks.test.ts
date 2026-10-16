import { expect, test } from 'bun:test';
import type { ProjectTask } from '@sber-designer/shared-types';

import { tasksForComponent, tasksForComponentCatalog } from './storybook-component-tasks';

const tasks: ProjectTask[] = [
  {
    id: 'task-button',
    title: 'Button should expose loading usage docs',
    source: 'linear',
    screenIds: [],
  },
  {
    id: 'task-button-screen',
    title: 'Fix Button on Checkout screen',
    source: 'linear',
    screenIds: ['screen-checkout'],
  },
  {
    id: 'task-screen',
    title: 'Checkout screen layout issue',
    source: 'linear',
    screenIds: ['screen-checkout'],
  },
  {
    id: 'task-description',
    title: 'Design system cleanup',
    description: 'Add examples for Components/Button and action buttons.',
    source: 'linear',
    screenIds: [],
  },
];

test('component tasks include component-only matches and exclude screen-specific tasks', () => {
  expect(
    tasksForComponent(tasks, {
      componentName: 'Button',
      componentTitle: 'Components/Button',
      activeScreenName: 'Checkout',
    }).map((task) => task.id),
  ).toEqual(['task-button', 'task-description']);
});

test('component catalog tasks match any component and reject screen mentions', () => {
  expect(
    tasksForComponentCatalog(
      [
        {
          id: 'task-button',
          title: 'Improve Button spacing',
          source: 'linear',
          screenIds: [],
        },
        {
          id: 'task-table',
          title: 'Document Table density',
          source: 'linear',
          screenIds: [],
        },
        {
          id: 'task-screen',
          title: 'Fix Button on Checkout screen',
          source: 'linear',
          screenIds: [],
        },
        {
          id: 'task-other',
          title: 'Polish random copy',
          source: 'linear',
          screenIds: [],
        },
      ],
      {
        components: [
          { shortName: 'Button', title: 'Components/Button' },
          { shortName: 'Table', title: 'Components/Table' },
        ],
        screenNames: ['Checkout'],
      },
    ).map((task) => task.id),
  ).toEqual(['task-button', 'task-table']);
});
