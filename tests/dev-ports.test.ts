import { expect, test } from 'bun:test';

import { pickAvailablePort, resolveDevPorts } from '../scripts/dev-ports';

test('resolveDevPorts falls back when the default api port is occupied', async () => {
  const result = await resolveDevPorts({
    env: {},
    isPortAvailable: async (port) => port !== 3000,
  });

  expect(result.apiPort).toBe(3002);
  expect(result.sandboxPort).toBe(3001);
  expect(result.webPort).toBe(5173);
  expect(result.apiEnv.PORT).toBe('3002');
  expect(result.apiEnv.SBER_DESIGNER_SANDBOX_URL).toBe('http://localhost:3001');
  expect(result.webEnv.VITE_API_URL).toBe('http://localhost:3002');
  expect(result.webEnv.VITE_PORT).toBe('5173');
});

test('resolveDevPorts reports the actual fallback web port', async () => {
  const result = await resolveDevPorts({
    env: {},
    isPortAvailable: async (port) => port !== 5173,
  });

  expect(result.apiPort).toBe(3000);
  expect(result.sandboxPort).toBe(3001);
  expect(result.webPort).toBe(5174);
  expect(result.webEnv.VITE_API_URL).toBe('http://localhost:3000');
  expect(result.webEnv.VITE_PORT).toBe('5174');
});

test('pickAvailablePort skips reserved ports before probing', async () => {
  const probed: number[] = [];
  const port = await pickAvailablePort(
    3000,
    async (candidate) => {
      probed.push(candidate);
      return candidate !== 3000;
    },
    new Set([3001]),
  );

  expect(port).toBe(3002);
  expect(probed).toEqual([3000, 3002]);
});
