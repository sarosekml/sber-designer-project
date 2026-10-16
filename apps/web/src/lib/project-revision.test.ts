import { expect, test } from 'bun:test';
import {
  carryProjectRevision,
  projectRevisionHeader,
  withProjectRevision,
} from './project-revision';

const project = {
  version: 1 as const,
  name: 'Fixture',
  workspacePath: '/fixture',
  screens: [],
  flow: [],
};

test('the revision travels with the edited snapshot, never with a newer background fetch', () => {
  const first = withProjectRevision({ ...project }, '"first"');
  const draft = { ...first, name: 'My edit' };
  const fetched = withProjectRevision({ ...project }, '"second"');
  expect(projectRevisionHeader(draft)).toBe('"first"');
  expect(projectRevisionHeader(fetched)).toBe('"second"');
  expect(JSON.parse(JSON.stringify(draft))).toEqual({ ...project, name: 'My edit' });
  expect(projectRevisionHeader(carryProjectRevision(draft, fetched))).toBe('"second"');
});
