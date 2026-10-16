import { randomBytes, timingSafeEqual } from 'node:crypto';

import { create as createSvgCaptcha } from 'svg-captcha';

import type { AuthMode } from './types';

export const CAPTCHA_TTL_MS = 5 * 60 * 1000;
export const CAPTCHA_CAPACITY = 500;

const CAPTCHA_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const FORBIDDEN_SVG =
  /<(?:text|script|foreignObject|image|use|iframe|object|embed)\b|\b(?:href|xlink:href)\s*=|\burl\s*\(/iu;

export type CaptchaMode = 'off' | 'register' | 'always';

export interface CaptchaChallenge {
  challengeId: string;
  svg: string;
  expiresAt: string;
}

export interface CaptchaGeneratorResult {
  text: string;
  data: string;
}

interface StoredChallenge {
  answer: string;
  expiresAt: number;
}

type AuthEnvironment = Record<string, string | undefined>;

export class CaptchaStore {
  private readonly challenges = new Map<string, StoredChallenge>();
  private readonly now: () => number;
  private readonly generator: () => CaptchaGeneratorResult;
  private readonly ttlMs: number;
  private readonly capacity: number;

  constructor(
    options: {
      now?: () => number;
      generator?: () => CaptchaGeneratorResult;
      ttlMs?: number;
      capacity?: number;
    } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.generator = options.generator ?? generateCaptcha;
    this.ttlMs = options.ttlMs ?? CAPTCHA_TTL_MS;
    this.capacity = options.capacity ?? CAPTCHA_CAPACITY;
    if (this.ttlMs <= 0 || this.capacity <= 0) {
      throw new Error('Captcha TTL and capacity must be positive');
    }
  }

  issue(): CaptchaChallenge {
    const now = this.now();
    this.purgeExpired(now);
    while (this.challenges.size >= this.capacity) {
      const oldestId = this.challenges.keys().next().value as string | undefined;
      if (!oldestId) break;
      this.challenges.delete(oldestId);
    }

    const generated = this.generator();
    assertSafeCaptcha(generated);
    const challengeId = randomBytes(18).toString('base64url');
    const expiresAt = now + this.ttlMs;
    this.challenges.set(challengeId, {
      answer: normalizeAnswer(generated.text),
      expiresAt,
    });
    return { challengeId, svg: generated.data, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** Every verification attempt consumes the challenge, including a wrong answer. */
  verify(captchaId: string | undefined, answer: string | undefined): boolean {
    if (!captchaId) return false;
    const challenge = this.challenges.get(captchaId);
    if (!challenge) return false;
    this.challenges.delete(captchaId);
    if (challenge.expiresAt <= this.now() || answer === undefined) return false;
    return safeEqual(challenge.answer, normalizeAnswer(answer));
  }

  get size(): number {
    this.purgeExpired(this.now());
    return this.challenges.size;
  }

  private purgeExpired(now: number): void {
    for (const [id, challenge] of this.challenges) {
      if (challenge.expiresAt <= now) this.challenges.delete(id);
    }
  }
}

export function resolveCaptchaMode(
  authMode: AuthMode,
  env: AuthEnvironment = process.env,
): CaptchaMode {
  const configured = env.SBER_DESIGNER_CAPTCHA?.trim().toLowerCase();
  if (configured && configured !== 'off' && configured !== 'register' && configured !== 'always') {
    throw new Error(
      `SBER_DESIGNER_CAPTCHA must be off, register, or always; received ${configured}`,
    );
  }
  return (configured as CaptchaMode | undefined) ?? (authMode === 'password' ? 'register' : 'off');
}

function generateCaptcha(): CaptchaGeneratorResult {
  return createSvgCaptcha({
    size: 5,
    charPreset: CAPTCHA_CHARACTERS,
    noise: 3,
    color: true,
    background: '#f7f7f8',
    width: 180,
    height: 60,
    fontSize: 52,
  });
}

function assertSafeCaptcha(generated: CaptchaGeneratorResult): void {
  if (normalizeAnswer(generated.text).length !== 5) {
    throw new Error('Captcha generator must return exactly five characters');
  }
  if (!/^<svg\b/iu.test(generated.data) || !/<path\b/iu.test(generated.data)) {
    throw new Error('Captcha generator must return an SVG made from path glyphs');
  }
  if (FORBIDDEN_SVG.test(generated.data)) {
    throw new Error('Captcha SVG contains a network-capable or unsafe element');
  }
}

function normalizeAnswer(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function safeEqual(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
