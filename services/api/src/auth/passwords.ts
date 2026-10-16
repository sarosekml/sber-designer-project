export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 256;

export class PasswordPolicyError extends Error {
  readonly code = 'weak_password';

  constructor(message: string) {
    super(message);
    this.name = 'PasswordPolicyError';
  }
}

export function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new PasswordPolicyError(
      `Password must contain ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters`,
    );
  }
}

export async function hashPassword(
  password: string,
  options: { enforcePolicy?: boolean } = {},
): Promise<string> {
  if (options.enforcePolicy !== false) validatePassword(password);
  return bunPasswordApi().hash(password, { algorithm: 'argon2id' });
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await bunPasswordApi().verify(password, passwordHash);
  } catch {
    return false;
  }
}

interface BunPasswordApi {
  hash(password: string, options: { algorithm: 'argon2id' }): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

function bunPasswordApi(): BunPasswordApi {
  const api = (globalThis as { Bun?: { password?: BunPasswordApi } }).Bun?.password;
  if (!api) throw new Error('Password authentication requires the Bun runtime');
  return api;
}
