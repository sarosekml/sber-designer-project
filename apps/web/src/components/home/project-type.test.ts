import { expect, test } from 'bun:test';

import { projectTypePresentation } from './project-type';

test('project type labels distinguish Storybook, HTML, React, and unknown projects', () => {
  expect(projectTypePresentation('storybook')).toEqual({
    label: 'Storybook',
    description: 'Component project with Storybook',
  });
  expect(projectTypePresentation('html')).toEqual({
    label: 'HTML/CSS',
    description: 'Static HTML and CSS project',
  });
  expect(projectTypePresentation('react').label).toBe('React');
  expect(projectTypePresentation('unknown').label).toBe('Project');
});
