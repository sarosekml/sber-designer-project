import { expect, test } from 'bun:test';

import { clientNeedsAuthBootstrap, resolveClientStartupProfile } from './startup-profile';

test('plain web development defaults to direct local startup', () => {
  const profile = resolveClientStartupProfile({});
  expect(profile).toEqual({ deploymentMode: 'local', authMode: 'local' });
  expect(clientNeedsAuthBootstrap(profile)).toBe(false);
});

test('local auth harness and server builds keep session bootstrap enabled', () => {
  const harness = resolveClientStartupProfile({
    deploymentMode: 'local',
    authMode: 'password',
  });
  const server = resolveClientStartupProfile({
    deploymentMode: 'server',
    authMode: 'password',
  });
  expect(clientNeedsAuthBootstrap(harness)).toBe(true);
  expect(clientNeedsAuthBootstrap(server)).toBe(true);
});

test('server web build rejects an unauthenticated profile', () => {
  expect(() =>
    resolveClientStartupProfile({ deploymentMode: 'server', authMode: 'local' }),
  ).toThrow('requires password or oidc');
});
