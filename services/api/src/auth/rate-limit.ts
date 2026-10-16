export const LOGIN_IP_LIMIT = 10;
export const LOGIN_IP_WINDOW_MS = 60 * 1000;
export const REGISTER_IP_LIMIT = 5;
export const REGISTER_IP_WINDOW_MS = 60 * 60 * 1000;
export const CAPTCHA_IP_LIMIT = 30;
export const CAPTCHA_IP_WINDOW_MS = 60 * 60 * 1000;
export const LOGIN_FAILURE_CAPTCHA_THRESHOLD = 5;
export const LOGIN_FAILURE_LOCK_THRESHOLD = 15;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

const DEFAULT_KEY_CAPACITY = 10_000;

interface WindowEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
}

export interface LoginFailureStatus {
  failures: number;
  captchaRequired: boolean;
  locked: boolean;
  retryAfter: number;
}

interface FailureEntry {
  failures: number[];
  lockUntil: number;
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, WindowEntry>();
  private readonly now: () => number;
  private readonly capacity: number;

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    options: { now?: () => number; capacity?: number } = {},
  ) {
    if (limit <= 0 || windowMs <= 0) throw new Error('Rate limit and window must be positive');
    this.now = options.now ?? Date.now;
    this.capacity = options.capacity ?? DEFAULT_KEY_CAPACITY;
    if (this.capacity <= 0) throw new Error('Rate-limit capacity must be positive');
  }

  consume(key: string): RateLimitResult {
    const now = this.now();
    this.purgeExpired(now);
    let entry = this.entries.get(key);
    if (!entry) {
      this.evictIfFull();
      entry = { count: 0, resetAt: now + this.windowMs };
      this.entries.set(key, entry);
    }

    if (entry.count >= this.limit) {
      return {
        allowed: false,
        retryAfter: secondsUntil(entry.resetAt, now),
        remaining: 0,
      };
    }
    entry.count += 1;
    return {
      allowed: true,
      retryAfter: 0,
      remaining: Math.max(0, this.limit - entry.count),
    };
  }

  private purgeExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }

  private evictIfFull(): void {
    while (this.entries.size >= this.capacity) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) return;
      this.entries.delete(oldestKey);
    }
  }
}

export class LoginFailureTracker {
  private readonly entries = new Map<string, FailureEntry>();
  private readonly now: () => number;
  private readonly capacity: number;

  constructor(options: { now?: () => number; capacity?: number } = {}) {
    this.now = options.now ?? Date.now;
    this.capacity = options.capacity ?? DEFAULT_KEY_CAPACITY;
    if (this.capacity <= 0) throw new Error('Login-failure capacity must be positive');
  }

  status(email: string): LoginFailureStatus {
    const now = this.now();
    const entry = this.entries.get(email);
    if (!entry) return emptyFailureStatus();
    this.prune(entry, now);
    if (entry.lockUntil <= now) entry.lockUntil = 0;
    if (entry.failures.length === 0 && entry.lockUntil === 0) {
      this.entries.delete(email);
      return emptyFailureStatus();
    }
    return failureStatus(entry, now);
  }

  recordFailure(email: string): LoginFailureStatus {
    const now = this.now();
    let entry = this.entries.get(email);
    if (!entry) {
      this.evictIfFull();
      entry = { failures: [], lockUntil: 0 };
      this.entries.set(email, entry);
    }
    this.prune(entry, now);
    if (entry.lockUntil > now) return failureStatus(entry, now);
    entry.lockUntil = 0;
    entry.failures.push(now);
    if (entry.failures.length >= LOGIN_FAILURE_LOCK_THRESHOLD) {
      entry.lockUntil = now + LOGIN_LOCK_MS;
    }
    return failureStatus(entry, now);
  }

  recordSuccess(email: string): void {
    this.entries.delete(email);
  }

  private prune(entry: FailureEntry, now: number): void {
    const cutoff = now - LOGIN_FAILURE_WINDOW_MS;
    entry.failures = entry.failures.filter((timestamp) => timestamp > cutoff);
  }

  private evictIfFull(): void {
    while (this.entries.size >= this.capacity) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) return;
      this.entries.delete(oldestKey);
    }
  }
}

export class AuthRateLimits {
  readonly loginByIp: FixedWindowRateLimiter;
  readonly registerByIp: FixedWindowRateLimiter;
  readonly captchaByIp: FixedWindowRateLimiter;
  readonly loginFailures: LoginFailureTracker;

  constructor(options: { now?: () => number; capacity?: number } = {}) {
    this.loginByIp = new FixedWindowRateLimiter(LOGIN_IP_LIMIT, LOGIN_IP_WINDOW_MS, options);
    this.registerByIp = new FixedWindowRateLimiter(
      REGISTER_IP_LIMIT,
      REGISTER_IP_WINDOW_MS,
      options,
    );
    this.captchaByIp = new FixedWindowRateLimiter(CAPTCHA_IP_LIMIT, CAPTCHA_IP_WINDOW_MS, options);
    this.loginFailures = new LoginFailureTracker(options);
  }
}

function emptyFailureStatus(): LoginFailureStatus {
  return { failures: 0, captchaRequired: false, locked: false, retryAfter: 0 };
}

function failureStatus(entry: FailureEntry, now: number): LoginFailureStatus {
  const locked = entry.lockUntil > now;
  return {
    failures: entry.failures.length,
    captchaRequired: entry.failures.length >= LOGIN_FAILURE_CAPTCHA_THRESHOLD,
    locked,
    retryAfter: locked ? secondsUntil(entry.lockUntil, now) : 0,
  };
}

function secondsUntil(deadline: number, now: number): number {
  return Math.max(1, Math.ceil((deadline - now) / 1000));
}
