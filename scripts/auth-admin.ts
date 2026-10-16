#!/usr/bin/env bun

import { AuthError } from '../services/api/src/auth/errors';
import { normalizeEmail } from '../services/api/src/auth/identity';
import { AuthService } from '../services/api/src/auth/service';
import { AuthStore } from '../services/api/src/auth/store';

export interface AuthAdminCliDependencies {
  store: AuthStore;
  service: AuthService;
  writeLine: (line: string) => void;
}

export async function runAuthAdminCommand(
  args: string[],
  dependencies: AuthAdminCliDependencies,
): Promise<void> {
  const [command, emailInput, ...extra] = args;
  if (extra.length > 0) throw new Error(usage());

  if (command === 'list' && emailInput === undefined) {
    const users = await dependencies.service.listUsers();
    dependencies.writeLine('email\trole\tstatus\tdisplayName');
    for (const user of users.sort((left, right) => left.email.localeCompare(right.email))) {
      dependencies.writeLine(
        `${user.email}\t${user.role}\t${user.status}\t${user.displayName.replaceAll('\t', ' ')}`,
      );
    }
    return;
  }

  if (!emailInput || !['promote', 'reset-password', 'disable'].includes(command ?? '')) {
    throw new Error(usage());
  }

  const email = normalizeEmail(emailInput);
  const user = (await dependencies.service.listUsers()).find(
    (candidate) => candidate.email === email,
  );
  if (!user) throw new AuthError('not_found', 404, `User not found: ${email}`);

  if (command === 'promote') {
    const updated = await dependencies.service.setUserAccess(user.id, { role: 'admin' });
    dependencies.writeLine(`Promoted ${updated.email} to admin.`);
    return;
  }

  if (command === 'disable') {
    const updated = await dependencies.service.setUserAccess(user.id, { status: 'disabled' });
    dependencies.writeLine(`Disabled ${updated.email}; all sessions were revoked.`);
    return;
  }

  const reset = await dependencies.service.resetUserPassword(user.id);
  dependencies.writeLine(`Temporary password for ${reset.user.email}: ${reset.temporaryPassword}`);
  dependencies.writeLine('This password is shown once. The user must change it after signing in.');
}

export function usage(): string {
  return [
    'Usage: bun run scripts/auth-admin.ts <command>',
    '',
    'Commands:',
    '  list',
    '  promote <email>',
    '  reset-password <email>',
    '  disable <email>',
  ].join('\n');
}

async function main(): Promise<void> {
  const store = new AuthStore();
  const service = new AuthService('password', store);
  await runAuthAdminCommand(process.argv.slice(2), {
    store,
    service,
    writeLine: (line) => process.stdout.write(`${line}\n`),
  });
}

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
