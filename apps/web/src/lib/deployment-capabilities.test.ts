import { expect, test } from 'bun:test';

import { resolveDeploymentCapabilities } from './deployment-capabilities';

test('local profiles leave repository copying and sharing to the user', () => {
  expect(resolveDeploymentCapabilities(undefined)).toEqual({
    canDuplicateProjects: false,
    canShareProjects: false,
    canOpenProjectInHostApps: true,
  });
  expect(resolveDeploymentCapabilities('local')).toEqual({
    canDuplicateProjects: false,
    canShareProjects: false,
    canOpenProjectInHostApps: true,
  });
});

test('server profile enables managed project duplication and sharing', () => {
  expect(resolveDeploymentCapabilities('server')).toEqual({
    canDuplicateProjects: true,
    canShareProjects: true,
    canOpenProjectInHostApps: false,
  });
});
