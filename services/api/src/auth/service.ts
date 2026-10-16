import { randomBytes } from 'node:crypto';

import { AuthError } from './errors';
import { normalizeDisplayName, normalizeEmail, parseAdminEmails } from './identity';
import { hashPassword, PasswordPolicyError, validatePassword, verifyPassword } from './passwords';
import { SessionManager, type IssuedSession, type SessionRequestMetadata } from './sessions';
import { AuthStore } from './store';
import {
  toSessionUser,
  type AuthMode,
  type AdminUser,
  type AuthUserRecord,
  type RequestSessionIdentity,
  type SessionUser,
  type UserRole,
  type UserStatus,
  toAdminUser,
} from './types';

type AuthEnvironment = Record<string, string | undefined>;

export interface PasswordCodec {
  hash(password: string, enforcePolicy?: boolean): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

const DEFAULT_PASSWORD_CODEC: PasswordCodec = {
  async hash(password, enforcePolicy = true) {
    return hashPassword(password, { enforcePolicy });
  },
  verify: verifyPassword,
};

// A fixed valid argon2id hash keeps unknown-email logins on the same expensive
// verification path as known accounts. The plaintext used to create it is not
// a credential and is intentionally not present at runtime.
const INVALID_LOGIN_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=2,p=1$O5VVewZ6LH/Z4gev5HA0WbA2+RhN+ZUjTI3vwcVrk0M$9fzirXD8s7By0LK2pNHE9QEu1zcR2qlGiD6E7Ujq0S0';

export interface AuthResult {
  user: SessionUser;
  issuedSession: IssuedSession;
}

export interface AdminUserAccessPatch {
  role?: UserRole;
  status?: UserStatus;
}

export interface PasswordResetResult {
  user: AdminUser;
  temporaryPassword: string;
}

export class AuthService {
  readonly sessions: SessionManager;
  private readonly now: () => number;
  private readonly env: AuthEnvironment;
  private readonly passwordCodec: PasswordCodec;
  private readonly adminEmails: Set<string>;
  private readonly logger: (message: string) => void;
  private initialization: Promise<void> | null = null;

  constructor(
    readonly mode: AuthMode,
    readonly store: AuthStore,
    options: {
      sessions?: SessionManager;
      now?: () => number;
      env?: AuthEnvironment;
      passwordCodec?: PasswordCodec;
      logger?: (message: string) => void;
    } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.env = options.env ?? process.env;
    this.passwordCodec = options.passwordCodec ?? DEFAULT_PASSWORD_CODEC;
    this.sessions = options.sessions ?? new SessionManager(store, { now: this.now });
    this.adminEmails =
      mode === 'password' ? parseAdminEmails(this.env.SBER_DESIGNER_ADMIN_EMAILS) : new Set();
    this.logger = options.logger ?? ((message) => process.stderr.write(`${message}\n`));
  }

  initialize(): Promise<void> {
    this.initialization ??= this.initializeOnce();
    return this.initialization;
  }

  async status(): Promise<{
    authMode: AuthMode;
    registration: 'open' | 'closed';
  }> {
    if (this.mode === 'local') return { authMode: 'local', registration: 'closed' };
    const system = await this.store.readSystemSettings();
    return { authMode: this.mode, registration: system.registration };
  }

  async register(
    input: { email: string; password: string; displayName: string },
    metadata: SessionRequestMetadata,
  ): Promise<AuthResult> {
    await this.initialize();
    this.requirePasswordMode();
    const system = await this.store.readSystemSettings();
    if (system.registration === 'closed') {
      throw new AuthError('registration_closed', 403, 'Registration is closed');
    }

    const email = normalizeEmail(input.email);
    const displayName = normalizeDisplayName(input.displayName);
    const passwordHash = await this.hashWithPolicy(input.password);
    const now = new Date(this.now()).toISOString();

    const user = await this.store.mutateUsers((current) => {
      if (current.users.some((entry) => entry.email === email)) {
        throw new AuthError('email_taken', 409, 'An account with this email already exists');
      }
      const firstUser = current.users.length === 0;
      const role = firstUser || this.adminEmails.has(email) ? 'admin' : 'member';
      const created: AuthUserRecord = {
        id: `u_${randomBytes(6).toString('hex')}`,
        email,
        displayName,
        passwordHash,
        role,
        status: 'active',
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };
      return {
        value: { version: 1, users: [...current.users, created] },
        result: { user: created, firstUser },
      };
    });

    if (user.firstUser) {
      this.logger(
        `[auth] no bootstrap admin configured; first registered user ${email} became admin`,
      );
    }
    const issuedSession = await this.sessions.issue(user.user.id, metadata);
    return { user: toSessionUser(user.user), issuedSession };
  }

  async login(
    input: { email: string; password: string },
    metadata: SessionRequestMetadata,
  ): Promise<AuthResult> {
    await this.initialize();
    this.requirePasswordMode();
    const email = normalizeEmail(input.email);
    const users = await this.store.readUsers();
    const candidate = users.users.find((entry) => entry.email === email);
    const passwordMatches = await this.passwordCodec.verify(
      input.password,
      candidate?.passwordHash ?? INVALID_LOGIN_PASSWORD_HASH,
    );
    if (!candidate || !passwordMatches) {
      throw new AuthError('invalid_credentials', 401, 'Invalid email or password');
    }
    if (candidate.status === 'disabled') {
      throw new AuthError('account_disabled', 403, 'This account is disabled');
    }

    const now = new Date(this.now()).toISOString();
    const user = await this.store.mutateUsers((current) => {
      const currentUser = current.users.find((entry) => entry.id === candidate.id);
      if (!currentUser) {
        throw new AuthError('invalid_credentials', 401, 'Invalid email or password');
      }
      if (currentUser.status === 'disabled') {
        throw new AuthError('account_disabled', 403, 'This account is disabled');
      }
      const updated: AuthUserRecord = {
        ...currentUser,
        role: this.adminEmails.has(currentUser.email) ? 'admin' : currentUser.role,
        lastLoginAt: now,
        updatedAt: now,
      };
      return {
        value: {
          version: 1,
          users: current.users.map((entry) => (entry.id === updated.id ? updated : entry)),
        },
        result: updated,
      };
    });

    const issuedSession = await this.sessions.issue(user.id, metadata);
    return { user: toSessionUser(user), issuedSession };
  }

  async authenticateSession(token: string): Promise<RequestSessionIdentity | null> {
    await this.initialize();
    if (this.mode !== 'password') return null;
    const verified = await this.sessions.verify(token);
    if (!verified) return null;
    const users = await this.store.readUsers();
    const user = users.users.find((entry) => entry.id === verified.session.userId);
    if (!user || user.status !== 'active') {
      await this.sessions.revokeById(verified.session.id);
      return null;
    }
    return {
      user: toSessionUser(user),
      sessionId: verified.session.id,
      renewedToken: verified.renewedToken,
      expiresAt: verified.session.expiresAt,
    };
  }

  async logout(token: string): Promise<void> {
    if (this.mode === 'password') await this.sessions.revoke(token);
  }

  async updateProfile(userId: string, displayNameInput: string): Promise<SessionUser> {
    const displayName = normalizeDisplayName(displayNameInput);
    const now = new Date(this.now()).toISOString();
    const user = await this.store.mutateUsers((current) => {
      const existing = current.users.find((entry) => entry.id === userId);
      if (!existing || existing.status !== 'active') {
        throw new AuthError('unauthenticated', 401, 'Authentication required');
      }
      const updated = { ...existing, displayName, updatedAt: now };
      return {
        value: {
          version: 1,
          users: current.users.map((entry) => (entry.id === userId ? updated : entry)),
        },
        result: updated,
      };
    });
    return toSessionUser(user);
  }

  async changePassword(input: {
    userId: string;
    sessionId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<SessionUser> {
    const users = await this.store.readUsers();
    const candidate = users.users.find((entry) => entry.id === input.userId);
    if (
      !candidate ||
      candidate.status !== 'active' ||
      !(await this.passwordCodec.verify(input.currentPassword, candidate.passwordHash))
    ) {
      throw new AuthError('invalid_credentials', 401, 'Current password is incorrect');
    }
    const passwordHash = await this.hashWithPolicy(input.newPassword);
    const now = new Date(this.now()).toISOString();
    const user = await this.store.mutateUsers((current) => {
      const existing = current.users.find((entry) => entry.id === input.userId);
      if (!existing || existing.status !== 'active') {
        throw new AuthError('unauthenticated', 401, 'Authentication required');
      }
      const updated: AuthUserRecord = {
        ...existing,
        passwordHash,
        mustChangePassword: false,
        updatedAt: now,
      };
      return {
        value: {
          version: 1,
          users: current.users.map((entry) => (entry.id === updated.id ? updated : entry)),
        },
        result: updated,
      };
    });
    await this.sessions.revokeAllForUser(user.id, input.sessionId);
    return toSessionUser(user);
  }

  /** Stage 7 admin routes use this so disabling a user revokes live sessions. */
  async setUserStatus(userId: string, status: UserStatus): Promise<SessionUser> {
    return toSessionUser(await this.setUserAccess(userId, { status }));
  }

  async listUsers(): Promise<AdminUser[]> {
    const users = await this.store.readUsers();
    return users.users.map(toAdminUser);
  }

  async setUserAccess(userId: string, patch: AdminUserAccessPatch): Promise<AdminUser> {
    if (patch.role === undefined && patch.status === undefined) {
      throw new AuthError('invalid_request', 400, 'Role or status is required');
    }
    const now = new Date(this.now()).toISOString();
    const user = await this.store.mutateUsers((current) => {
      const existing = current.users.find((entry) => entry.id === userId);
      if (!existing) throw new AuthError('not_found', 404, 'User not found');
      const nextRole = patch.role ?? existing.role;
      const nextStatus = patch.status ?? existing.status;
      if (
        existing.role === 'admin' &&
        existing.status === 'active' &&
        (nextRole !== 'admin' || nextStatus !== 'active') &&
        !current.users.some(
          (entry) => entry.id !== userId && entry.role === 'admin' && entry.status === 'active',
        )
      ) {
        throw new AuthError('last_admin', 409, 'The last active admin cannot be changed');
      }
      const updated: AuthUserRecord = {
        ...existing,
        role: nextRole,
        status: nextStatus,
        updatedAt: now,
      };
      return {
        value: {
          version: 1,
          users: current.users.map((entry) => (entry.id === userId ? updated : entry)),
        },
        result: updated,
      };
    });
    if (user.status === 'disabled') await this.sessions.revokeAllForUser(user.id);
    return toAdminUser(user);
  }

  async resetUserPassword(userId: string): Promise<PasswordResetResult> {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.hashWithPolicy(temporaryPassword);
    const now = new Date(this.now()).toISOString();
    const user = await this.store.mutateUsers((current) => {
      const existing = current.users.find((entry) => entry.id === userId);
      if (!existing) throw new AuthError('not_found', 404, 'User not found');
      const updated: AuthUserRecord = {
        ...existing,
        passwordHash,
        mustChangePassword: true,
        updatedAt: now,
      };
      return {
        value: {
          version: 1,
          users: current.users.map((entry) => (entry.id === userId ? updated : entry)),
        },
        result: updated,
      };
    });
    await this.sessions.revokeAllForUser(user.id);
    return { user: toAdminUser(user), temporaryPassword };
  }

  async deleteUser(userId: string): Promise<AdminUser> {
    const user = await this.store.mutateUsers((current) => {
      const existing = current.users.find((entry) => entry.id === userId);
      if (!existing) throw new AuthError('not_found', 404, 'User not found');
      if (existing.status !== 'disabled') {
        throw new AuthError(
          'user_must_be_disabled',
          409,
          'Disable the user before deleting the account',
        );
      }
      return {
        value: {
          version: 1,
          users: current.users.filter((entry) => entry.id !== userId),
        },
        result: existing,
      };
    });
    await this.sessions.revokeAllForUser(user.id);
    return toAdminUser(user);
  }

  private async initializeOnce(): Promise<void> {
    if (this.mode !== 'password') return;
    const devSeed = this.env.SBER_DESIGNER_AUTH_DEV_SEED?.trim() === '1';
    if (devSeed && this.env.SBER_DESIGNER_PUBLIC_URL?.trim()) {
      throw new Error(
        'SBER_DESIGNER_AUTH_DEV_SEED=1 is forbidden when SBER_DESIGNER_PUBLIC_URL is set',
      );
    }

    const bootstrapEmail = this.env.SBER_DESIGNER_BOOTSTRAP_ADMIN_EMAIL?.trim();
    const bootstrapPassword = this.env.SBER_DESIGNER_BOOTSTRAP_ADMIN_PASSWORD;
    if (Boolean(bootstrapEmail) !== Boolean(bootstrapPassword)) {
      throw new Error(
        'Set both SBER_DESIGNER_BOOTSTRAP_ADMIN_EMAIL and SBER_DESIGNER_BOOTSTRAP_ADMIN_PASSWORD',
      );
    }

    if (bootstrapEmail && bootstrapPassword) {
      await this.ensureBootstrapAdmin(bootstrapEmail, bootstrapPassword);
      return;
    }
    if (devSeed) await this.ensureDevSeed();
  }

  private async ensureBootstrapAdmin(emailInput: string, password: string): Promise<void> {
    const email = normalizeEmail(emailInput);
    validatePassword(password);
    const users = await this.store.readUsers();
    if (users.users.some((entry) => entry.email === email)) {
      await this.store.mutateUsers((current) => ({
        value: {
          version: 1,
          users: current.users.map((entry) =>
            entry.email === email ? { ...entry, role: 'admin' as const } : entry,
          ),
        },
        result: undefined,
      }));
      return;
    }
    const passwordHash = await this.passwordCodec.hash(password, true);
    const now = new Date(this.now()).toISOString();
    await this.store.mutateUsers((current) => {
      if (current.users.some((entry) => entry.email === email)) {
        return { value: current, result: undefined, write: false };
      }
      const user: AuthUserRecord = {
        id: `u_${randomBytes(6).toString('hex')}`,
        email,
        displayName: bootstrapDisplayName(email),
        passwordHash,
        role: 'admin',
        status: 'active',
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
      };
      return {
        value: { version: 1, users: [...current.users, user] },
        result: undefined,
      };
    });
  }

  private async ensureDevSeed(): Promise<void> {
    const passwordHash = await this.passwordCodec.hash('admin', false);
    const now = new Date(this.now()).toISOString();
    await this.store.mutateUsers((current) => {
      if (current.users.length > 0) return { value: current, result: undefined, write: false };
      const user: AuthUserRecord = {
        id: `u_${randomBytes(6).toString('hex')}`,
        email: 'admin@local',
        displayName: 'Local Admin',
        passwordHash,
        role: 'admin',
        status: 'active',
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
      };
      return { value: { version: 1, users: [user] }, result: undefined };
    });
  }

  private async hashWithPolicy(password: string): Promise<string> {
    try {
      return await this.passwordCodec.hash(password, true);
    } catch (error) {
      if (error instanceof PasswordPolicyError) {
        throw new AuthError(error.code, 400, error.message);
      }
      throw error;
    }
  }

  private requirePasswordMode(): void {
    if (this.mode !== 'password') {
      throw new AuthError('auth_mode_unsupported', 404, 'Password authentication is not enabled');
    }
  }
}

function bootstrapDisplayName(email: string): string {
  const localPart = email.split('@')[0]?.trim() ?? '';
  return localPart.length >= 2 ? localPart.slice(0, 64) : 'Administrator';
}

export function generateTemporaryPassword(): string {
  return `Temp-${randomBytes(15).toString('base64url')}`;
}
