import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { AuthStore } from './store';
import type { AuthSessionRecord } from './types';

export const SESSION_COOKIE_NAME = 'sd_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const SESSION_RENEWAL_WINDOW_MS = 15 * 24 * 60 * 60 * 1_000;
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1_000;

export interface SessionRequestMetadata {
  userAgent: string;
  ip: string;
}

export interface IssuedSession {
  token: string;
  session: AuthSessionRecord;
}

export interface VerifiedSession {
  session: AuthSessionRecord;
  renewedToken: string | null;
}

export class SessionManager {
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly renewalWindowMs: number;
  private readonly touchIntervalMs: number;

  constructor(
    private readonly store: AuthStore,
    options: {
      now?: () => number;
      ttlMs?: number;
      renewalWindowMs?: number;
      touchIntervalMs?: number;
    } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? SESSION_TTL_MS;
    this.renewalWindowMs = options.renewalWindowMs ?? SESSION_RENEWAL_WINDOW_MS;
    this.touchIntervalMs = options.touchIntervalMs ?? SESSION_TOUCH_INTERVAL_MS;
  }

  async issue(userId: string, metadata: SessionRequestMetadata): Promise<IssuedSession> {
    const token = newSessionToken();
    const now = this.now();
    const timestamp = new Date(now).toISOString();
    const session: AuthSessionRecord = {
      id: `s_${randomBytes(6).toString('hex')}`,
      userId,
      tokenHash: hashSessionToken(token),
      createdAt: timestamp,
      expiresAt: new Date(now + this.ttlMs).toISOString(),
      lastSeenAt: timestamp,
      userAgent: metadata.userAgent.slice(0, 512),
      ip: metadata.ip.slice(0, 128),
    };

    await this.store.mutateSessions((current) => ({
      value: {
        version: 1,
        sessions: [
          ...current.sessions.filter((entry) => Date.parse(entry.expiresAt) > now),
          session,
        ],
      },
      result: undefined,
    }));
    return { token, session };
  }

  async verify(token: string): Promise<VerifiedSession | null> {
    const tokenHash = hashSessionToken(token);
    const now = this.now();

    return this.store.mutateSessions((current) => {
      const index = current.sessions.findIndex((entry) =>
        sessionHashesEqual(entry.tokenHash, tokenHash),
      );
      if (index < 0) return { value: current, result: null, write: false };

      const session = current.sessions[index];
      if (!session) return { value: current, result: null, write: false };
      if (Date.parse(session.expiresAt) <= now) {
        return {
          value: {
            version: 1,
            sessions: current.sessions.filter((_, entryIndex) => entryIndex !== index),
          },
          result: null,
        };
      }

      let nextSession = session;
      let renewedToken: string | null = null;
      let write = false;
      const remainingMs = Date.parse(session.expiresAt) - now;

      if (remainingMs < this.renewalWindowMs) {
        renewedToken = newSessionToken();
        nextSession = {
          ...nextSession,
          tokenHash: hashSessionToken(renewedToken),
          expiresAt: new Date(now + this.ttlMs).toISOString(),
        };
        write = true;
      }

      if (now - Date.parse(session.lastSeenAt) >= this.touchIntervalMs) {
        nextSession = { ...nextSession, lastSeenAt: new Date(now).toISOString() };
        write = true;
      }

      return {
        value: write
          ? {
              version: 1,
              sessions: current.sessions.map((entry, entryIndex) =>
                entryIndex === index ? nextSession : entry,
              ),
            }
          : current,
        result: { session: nextSession, renewedToken },
        write,
      };
    });
  }

  async revoke(token: string): Promise<boolean> {
    const tokenHash = hashSessionToken(token);
    return this.store.mutateSessions((current) => {
      const sessions = current.sessions.filter(
        (entry) => !sessionHashesEqual(entry.tokenHash, tokenHash),
      );
      const revoked = sessions.length !== current.sessions.length;
      return {
        value: revoked ? { version: 1, sessions } : current,
        result: revoked,
        write: revoked,
      };
    });
  }

  async revokeById(sessionId: string): Promise<boolean> {
    return this.store.mutateSessions((current) => {
      const sessions = current.sessions.filter((entry) => entry.id !== sessionId);
      const revoked = sessions.length !== current.sessions.length;
      return {
        value: revoked ? { version: 1, sessions } : current,
        result: revoked,
        write: revoked,
      };
    });
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    return this.store.mutateSessions((current) => {
      const sessions = current.sessions.filter(
        (entry) => entry.userId !== userId || entry.id === exceptSessionId,
      );
      const revoked = current.sessions.length - sessions.length;
      return {
        value: revoked > 0 ? { version: 1, sessions } : current,
        result: revoked,
        write: revoked > 0,
      };
    });
  }
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

function sessionHashesEqual(stored: string, candidate: string): boolean {
  const left = Buffer.from(stored, 'hex');
  const right = Buffer.from(candidate, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
