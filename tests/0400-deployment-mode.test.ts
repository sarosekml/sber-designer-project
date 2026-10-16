import { expect, test } from 'bun:test';

import { parseDeploymentMode } from '@sber-designer/shared-types';

import { assertDeploymentProfile } from '../services/api/src/deployment-mode';

test('deployment mode defaults to local and rejects unknown values', () => {
  expect(parseDeploymentMode(undefined)).toBe('local');
  expect(parseDeploymentMode(' local ')).toBe('local');
  expect(parseDeploymentMode('server')).toBe('server');
  expect(() => parseDeploymentMode('hybrid')).toThrow('must be local or server');
});

test('server profile requires real auth and managed data roots', () => {
  expect(() => assertDeploymentProfile('server', 'local', {})).toThrow('requires password or oidc');
  expect(() => assertDeploymentProfile('server', 'password', {})).toThrow(
    'SBER_DESIGNER_PROJECTS_ROOT',
  );
  expect(() =>
    assertDeploymentProfile('server', 'password', {
      SBER_DESIGNER_PROJECTS_ROOT: '/srv/projects',
      SBER_DESIGNER_USERS_ROOT: '/home/sd/.sber-designer/users',
      SBER_DESIGNER_AUTH_DEV_SEED: '1',
    }),
  ).toThrow('AUTH_DEV_SEED is forbidden');
  expect(() =>
    assertDeploymentProfile('server', 'password', {
      SBER_DESIGNER_PROJECTS_ROOT: '/srv/projects',
      SBER_DESIGNER_USERS_ROOT: '/home/sd/.sber-designer/users',
    }),
  ).not.toThrow();
});

test('local profile never requires server roots', () => {
  expect(() => assertDeploymentProfile('local', 'local', {})).not.toThrow();
});
