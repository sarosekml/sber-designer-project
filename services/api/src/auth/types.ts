export type AuthMode = 'local' | 'password' | 'oidc';
export type UserRole = 'admin' | 'member';
export type UserStatus = 'active' | 'disabled';

export interface AuthUserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  userAgent: string;
  ip: string;
}

export interface UsersFile {
  version: 1;
  users: AuthUserRecord[];
}

export interface SessionsFile {
  version: 1;
  sessions: AuthSessionRecord[];
}

export interface SystemSettings {
  version: 1;
  registration: 'open' | 'closed';
  dsBrowser: { defaultEnabled: boolean };
  agents: {
    enabledCliRuntimes: Array<'claude-code' | 'codex' | 'opencode' | 'kimi' | 'gigacode'>;
  };
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export type AdminUser = Omit<AuthUserRecord, 'passwordHash'>;

export function toAdminUser(user: AuthUserRecord): AdminUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export interface RequestSessionIdentity {
  user: SessionUser;
  sessionId: string;
  renewedToken: string | null;
  expiresAt: string;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  version: 1,
  registration: 'open',
  dsBrowser: { defaultEnabled: false },
  agents: { enabledCliRuntimes: ['claude-code', 'codex', 'opencode', 'kimi', 'gigacode'] },
};

export function toSessionUser(
  user: Pick<AuthUserRecord, 'id' | 'email' | 'displayName' | 'role' | 'mustChangePassword'>,
): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}
