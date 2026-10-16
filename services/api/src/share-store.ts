/**
 * In-memory share-link store (Phase 5.5).
 *
 * `POST /api/share` snapshots the active project + the live previewUrl
 * under a freshly-minted token. `GET /api/share/:token` returns the
 * snapshot — the read-only Demo viewer in apps/web reads from there.
 *
 * Tokens auto-expire (default 24 h) and the store evicts on every read
 * so we don't accumulate stale shares.
 *
 * Single-process for MVP. Phase 6 backs this with Postgres + signed
 * tokens + per-org shards.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SberDesignerProject } from '@sber-designer/shared-types';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface ShareEntry {
  token: string;
  expiresAt: number;
  createdAt: number;
  project: SberDesignerProject;
  previewUrl: string | null;
  createdBy: string;
  /** Phase 6.3 — sha256(salt + password) when set, otherwise undefined. */
  passwordHash?: string;
  /** Phase 6.3 — per-share salt, used with passwordHash. */
  passwordSalt?: string;
}

const shares = new Map<string, ShareEntry>();

export interface CreateShareInput {
  project: SberDesignerProject;
  previewUrl: string | null;
  createdBy: string;
  ttlMs?: number;
  /** Optional password — if set, viewers must provide it to read the share. */
  password?: string;
}

export interface ShareSnapshot {
  token: string;
  expiresAt: number;
  createdAt: number;
  project: SberDesignerProject;
  previewUrl: string | null;
  /** True when this share has a password gate. The hash itself is never returned. */
  passwordRequired: boolean;
}

export function createShare(input: CreateShareInput): ShareSnapshot {
  evictExpired();
  const token = randomBytes(16).toString('base64url');
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS;
  const entry: ShareEntry = {
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl,
    project: input.project,
    previewUrl: input.previewUrl,
    createdBy: input.createdBy,
  };
  if (input.password) {
    const salt = randomBytes(16).toString('hex');
    entry.passwordSalt = salt;
    entry.passwordHash = sha256Hex(salt + input.password);
  }
  shares.set(token, entry);
  return toSnapshot(entry);
}

export function getShare(token: string): ShareSnapshot | null {
  evictExpired();
  const entry = shares.get(token);
  if (!entry) return null;
  return toSnapshot(entry);
}

/**
 * Verify the supplied password against the stored hash.
 *
 * Returns:
 *  - 'no-share' if the token is unknown or expired
 *  - 'unlocked' if the share has no password set
 *  - 'ok' if the password matches
 *  - 'forbidden' if the password is missing or wrong
 */
export function verifySharePassword(
  token: string,
  password: string | undefined,
): 'no-share' | 'unlocked' | 'ok' | 'forbidden' {
  evictExpired();
  const entry = shares.get(token);
  if (!entry) return 'no-share';
  if (!entry.passwordHash || !entry.passwordSalt) return 'unlocked';
  if (!password) return 'forbidden';
  const expected = Buffer.from(entry.passwordHash, 'hex');
  const got = Buffer.from(sha256Hex(entry.passwordSalt + password), 'hex');
  if (expected.length !== got.length) return 'forbidden';
  return timingSafeEqual(expected, got) ? 'ok' : 'forbidden';
}

export function dropShare(token: string): boolean {
  return shares.delete(token);
}

export function shareCount(): number {
  evictExpired();
  return shares.size;
}

function toSnapshot(entry: ShareEntry): ShareSnapshot {
  return {
    token: entry.token,
    expiresAt: entry.expiresAt,
    createdAt: entry.createdAt,
    project: entry.project,
    previewUrl: entry.previewUrl,
    passwordRequired: Boolean(entry.passwordHash),
  };
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function evictExpired(): void {
  const now = Date.now();
  for (const [k, v] of shares) {
    if (v.expiresAt < now) shares.delete(k);
  }
}
