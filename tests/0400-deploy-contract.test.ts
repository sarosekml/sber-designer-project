import { expect, test } from 'bun:test';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

test('remote update preserves the server web profile across sudo env reset', async () => {
  const update = await Bun.file(resolve(ROOT, 'deploy/update.sh')).text();

  expect(update).toContain(
    'bun_bin="${SBER_DESIGNER_BUN_PATH:-/home/${service_user}/.bun/bin/bun}"',
  );
  expect(update).toContain('as_service_user "$bun_bin" install --frozen-lockfile');
  expect(update).toContain(
    [
      'as_service_user env \\',
      '  SBER_DESIGNER_DEPLOYMENT_MODE=server \\',
      '  SBER_DESIGNER_AUTH_MODE="${SBER_DESIGNER_AUTH_MODE:-password}" \\',
    ].join('\n'),
  );
  expect(update).toContain('"$bun_bin" run build');
  expect(update).not.toContain('as_service_user bun run build');
});

test('server deploy uses one explicit Bun executable for install, build, and smoke', async () => {
  const [update, envExample] = await Promise.all([
    Bun.file(resolve(ROOT, 'deploy/update.sh')).text(),
    Bun.file(resolve(ROOT, 'deploy/env.example')).text(),
  ]);

  expect(envExample).toContain('SBER_DESIGNER_BUN_PATH=/home/sd/.bun/bin/bun');
  expect(update).toContain('[[ "$bun_bin" == /* ]]');
  expect(update).toContain('[[ -x "$bun_bin" ]]');
  expect(update).toContain('"$bun_bin" run smoke:local-mvp');
});
