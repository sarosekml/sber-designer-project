import { expect, test } from 'bun:test';
import { GraduationCap, House, LayoutGrid } from 'lucide-react';

import { HOME_RAIL_ITEMS, homeRailItemIsActive, type HomeRailItem } from './HomeRail';

const ITEMS: HomeRailItem[] = [
  { label: 'Home', href: '/', icon: House },
  { label: 'Projects', href: '/projects', icon: LayoutGrid },
  { label: 'How it works', href: '/how-it-works', icon: GraduationCap },
];

test('rail keeps home, projects, and learning as primary destinations', () => {
  expect(HOME_RAIL_ITEMS.map((item) => item.label)).toEqual(['Home', 'Projects', 'How it works']);
  expect(HOME_RAIL_ITEMS.map((item) => item.href)).toEqual(['/', '/projects', '/how-it-works']);
  expect(ITEMS).toEqual(HOME_RAIL_ITEMS);
});

test('rail active state is exact for Home and Projects and nested for documentation routes', () => {
  expect(homeRailItemIsActive('/', '/')).toBe(true);
  expect(homeRailItemIsActive('/profile', '/')).toBe(false);
  expect(homeRailItemIsActive('/projects', '/projects')).toBe(true);
  expect(homeRailItemIsActive('/projects/archive', '/projects')).toBe(false);
  expect(homeRailItemIsActive('/', '/projects')).toBe(false);
  expect(homeRailItemIsActive('/how-it-works', '/how-it-works')).toBe(true);
  expect(homeRailItemIsActive('/how-it-works/canvas-and-sandbox', '/how-it-works')).toBe(true);
  expect(homeRailItemIsActive('/profile', '/how-it-works')).toBe(false);
});
