import { createHash, timingSafeEqual } from 'node:crypto';

export const SERVICE_TOKEN_HEADER = 'x-sber-designer-service-token';

export interface ServiceTokenEntry {
  name: string;
  token: string;
}

const SERVICE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/u;

export function parseServiceTokens(value: string | undefined): ServiceTokenEntry[] {
  const rawEntries = value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!rawEntries?.length) return [];

  const names = new Set<string>();
  return rawEntries.map((entry, index) => {
    const separator = entry.indexOf(':');
    const name = entry.slice(0, separator).trim().toLowerCase();
    const token = separator >= 0 ? entry.slice(separator + 1).trim() : '';
    if (!SERVICE_NAME_PATTERN.test(name)) {
      throw new Error(
        `Invalid service token name at entry ${index + 1}; use 1–32 lowercase letters, digits, _ or -`,
      );
    }
    if (token.length < 32) {
      throw new Error(`Service token "${name}" must contain at least 32 characters`);
    }
    if (names.has(name)) throw new Error(`Duplicate service token name "${name}"`);
    names.add(name);
    return { name, token };
  });
}

export function matchServiceToken(
  candidate: string | undefined,
  entries: readonly ServiceTokenEntry[],
): ServiceTokenEntry | null {
  if (!candidate || entries.length === 0) return null;
  for (const entry of entries) {
    if (constantTimeEqual(candidate, entry.token)) return entry;
  }
  return null;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left, 'utf8').digest();
  const rightDigest = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
