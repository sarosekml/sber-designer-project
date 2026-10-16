import { expect, test } from 'bun:test';
import type { ComponentEntry } from '@sber-designer/shared-types';
import { groupCatalogComponents } from './component-groups';

test('component grouping keeps catalog order while de-duplicating unstable repeated ids', () => {
  const component = (id: string, shortName: string, title: string) =>
    ({ id, shortName, title, stories: [] }) as ComponentEntry;

  const groups = groupCatalogComponents([
    component('button', 'Button', 'Atoms/Button'),
    component('button', 'Button duplicate', 'Atoms/Button'),
    component('card', 'Card', 'Molecules/Card'),
  ]);

  expect(groups.map((group) => [group.name, group.components.map((entry) => entry.id)])).toEqual([
    ['Atoms', ['button']],
    ['Molecules', ['card']],
  ]);
});
