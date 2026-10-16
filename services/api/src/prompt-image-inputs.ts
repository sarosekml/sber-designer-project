import {
  isPromptRasterImageMimeType,
  normalizePromptImageMimeType,
  type PromptRasterImageMimeType,
} from '@sber-designer/shared-types';

export interface RemoteImageFetchPolicy {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects: number;
  allowedHosts?: string[];
}

export interface RemoteImageBytes {
  bytes: Buffer;
  mimeType: PromptRasterImageMimeType;
  finalUrl: string;
}

export const DEFAULT_REMOTE_IMAGE_FETCH_POLICY: RemoteImageFetchPolicy = {
  maxBytes: 5 * 1024 * 1024,
  timeoutMs: 10_000,
  maxRedirects: 3,
};

export function assertSafeRemoteImageUrl(
  url: string,
  policy: RemoteImageFetchPolicy = DEFAULT_REMOTE_IMAGE_FETCH_POLICY,
): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error(
      'Remote image URL is not allowed. Use HTTPS or configure an explicit host allowlist.',
    );
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error('Remote image URL is not allowed because it targets a private network host.');
  }
  if (policy.allowedHosts?.length && !policy.allowedHosts.includes(parsed.hostname)) {
    throw new Error(`Remote image host "${parsed.hostname}" is not in the allowed host list.`);
  }
  return parsed;
}

export async function fetchRemoteImageBytes(input: {
  url: string;
  fetchImpl?: typeof fetch;
  policy?: RemoteImageFetchPolicy;
}): Promise<RemoteImageBytes> {
  const policy = input.policy ?? DEFAULT_REMOTE_IMAGE_FETCH_POLICY;
  const fetchImpl = input.fetchImpl ?? fetch;
  let current = assertSafeRemoteImageUrl(input.url, policy);

  for (let redirect = 0; redirect <= policy.maxRedirects; redirect += 1) {
    const response = await fetchImpl(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(policy.timeoutMs),
    });

    if (isRedirect(response.status)) {
      if (redirect === policy.maxRedirects) {
        throw new Error('Remote image URL exceeded the redirect limit.');
      }
      const location = response.headers.get('location');
      if (!location) throw new Error('Remote image redirect did not include a Location header.');
      current = assertSafeRemoteImageUrl(new URL(location, current).toString(), policy);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Remote image URL returned HTTP ${response.status}.`);
    }

    const mimeType = normalizePromptImageMimeType(
      response.headers.get('content-type') ?? '',
      current.pathname,
    );
    if (!mimeType || !isPromptRasterImageMimeType(mimeType)) {
      throw new Error('Remote image URL must return PNG, JPEG, or WebP content.');
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > policy.maxBytes) {
      throw new Error(`Remote image URL is larger than ${policy.maxBytes} bytes.`);
    }

    return { bytes, mimeType, finalUrl: current.toString() };
  }

  throw new Error('Remote image URL exceeded the redirect limit.');
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;

  const parts = host.split('.').map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}
