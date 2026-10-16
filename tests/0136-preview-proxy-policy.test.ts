/**
 * 0136 R03 — the preview proxies must not let the request path choose the
 * upstream origin, and the public share proxy must not forward the caller's
 * credentials.
 *
 * The review reproduced the defect against a live synthetic share:
 * `/api/preview-share/<token>//destination.invalid/fixture` called
 * `http://destination.invalid/fixture`, forwarded the POST body, and carried
 * the incoming Cookie and Authorization headers there.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import {
  buildForwardHeaders,
  buildResponseHeaders,
  buildUpstreamUrl,
  isAllowedProxyMethod,
  normalizeForwardPath,
} from '../services/api/src/routes/preview-proxy-policy';
import { previewShareRouter } from '../services/api/src/routes/preview-share';
import { createShare, dropShare } from '../services/api/src/share-store';

const UPSTREAM = 'http://127.0.0.1:54321';

const project: SberDesignerProject = {
  version: 1,
  name: 'fixture',
  workspacePath: '/tmp/sd-0136-share',
  screens: [],
  flow: [],
};

const createdTokens: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const token of createdTokens.splice(0)) dropShare(token);
});

function shareApp(): Hono {
  return new Hono().route('/api/preview-share', previewShareRouter);
}

function newShare(): string {
  const snapshot = createShare({ project, previewUrl: UPSTREAM, createdBy: 'test' });
  createdTokens.push(snapshot.token);
  return snapshot.token;
}

/** Records what the proxy would have called, and answers with a stub. */
function recordingFetch(): { calls: { url: string; init: RequestInit | undefined }[] } {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response('stub', { status: 200, headers: { 'content-type': 'text/plain' } });
  }) as typeof fetch;
  return { calls };
}

describe('0136 R03 upstream origin is pinned', () => {
  test('a protocol-relative path cannot move the origin', () => {
    const decision = buildUpstreamUrl({
      upstreamBase: UPSTREAM,
      incomingPath: '//destination.invalid/fixture',
      requestUrl: 'http://api.local/api/preview-share/tok//destination.invalid/fixture',
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.url.origin).toBe(UPSTREAM);
    expect(decision.url.hostname).toBe('127.0.0.1');
    expect(decision.url.pathname).toBe('/destination.invalid/fixture');
  });

  test('backslash and percent-encoded spellings collapse to a path', () => {
    expect(normalizeForwardPath('//evil.invalid/x')).toBe('/evil.invalid/x');
    expect(normalizeForwardPath('/\\evil.invalid/x')).toBe('/evil.invalid/x');
    expect(normalizeForwardPath('/%2f%2fevil.invalid/x')).toBe('/evil.invalid/x');
    expect(normalizeForwardPath('////evil.invalid')).toBe('/evil.invalid');
  });

  test('a traversal cannot climb above the upstream origin', () => {
    const decision = buildUpstreamUrl({
      upstreamBase: UPSTREAM,
      incomingPath: '/../../etc/passwd',
      requestUrl: 'http://api.local/api/preview',
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.url.origin).toBe(UPSTREAM);
  });

  test('the share proxy no longer calls the attacker-chosen host', async () => {
    const token = newShare();
    const { calls } = recordingFetch();
    const response = await shareApp().request(
      `/api/preview-share/${token}//destination.invalid/fixture`,
    );
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).origin).toBe(UPSTREAM);
    expect(calls[0]!.url).not.toContain('destination.invalid/fixture?');
    expect(new URL(calls[0]!.url).hostname).toBe('127.0.0.1');
  });
});

describe('0136 R03 shares are read-only and credential-free', () => {
  test('a POST through a share is refused', async () => {
    const token = newShare();
    const { calls } = recordingFetch();
    const response = await shareApp().request(`/api/preview-share/${token}/anything`, {
      method: 'POST',
      body: 'payload',
    });
    expect(response.status).toBe(405);
    expect(calls).toHaveLength(0);
  });

  test('GET and HEAD still reach the sandbox', () => {
    expect(isAllowedProxyMethod('GET', true)).toBe(true);
    expect(isAllowedProxyMethod('HEAD', true)).toBe(true);
    expect(isAllowedProxyMethod('POST', true)).toBe(false);
    expect(isAllowedProxyMethod('DELETE', true)).toBe(false);
    expect(isAllowedProxyMethod('POST', false)).toBe(true);
  });

  test('client credentials are stripped before forwarding', () => {
    const forwarded = buildForwardHeaders(
      new Headers({
        cookie: 'sd_session=secret',
        authorization: 'Bearer editor-token',
        'x-sber-designer-service-token': 'service',
        'x-share-password': 'hunter2',
        'x-sber-designer-user': 'ada@example.com',
        connection: 'keep-alive',
        host: 'api.local',
        accept: 'text/html',
      }),
    );
    expect(forwarded.get('cookie')).toBeNull();
    expect(forwarded.get('authorization')).toBeNull();
    expect(forwarded.get('x-sber-designer-service-token')).toBeNull();
    expect(forwarded.get('x-share-password')).toBeNull();
    expect(forwarded.get('x-sber-designer-user')).toBeNull();
    expect(forwarded.get('connection')).toBeNull();
    expect(forwarded.get('host')).toBeNull();
    expect(forwarded.get('accept')).toBe('text/html');
  });

  test('the live share request carries no Cookie or Authorization upstream', async () => {
    const token = newShare();
    const { calls } = recordingFetch();
    await shareApp().request(`/api/preview-share/${token}/index.html`, {
      headers: {
        cookie: 'sd_session=secret',
        authorization: 'Bearer editor-token',
      },
    });
    const sent = new Headers(calls[0]!.init?.headers);
    expect(sent.get('cookie')).toBeNull();
    expect(sent.get('authorization')).toBeNull();
  });

  test('the share password query parameter is not forwarded to the sandbox', async () => {
    const token = newShare();
    const { calls } = recordingFetch();
    await shareApp().request(`/api/preview-share/${token}/index.html?p=hunter2&keep=1`);
    const forwarded = new URL(calls[0]!.url);
    expect(forwarded.searchParams.get('p')).toBeNull();
    expect(forwarded.searchParams.get('keep')).toBe('1');
  });

  test('a public share response cannot set cookies on the editor origin', () => {
    const headers = buildResponseHeaders(
      new Headers({
        'set-cookie': 'evil=1',
        'content-type': 'text/html',
        'content-length': '10',
      }),
      { publicShare: true },
    );
    expect(headers.get('set-cookie')).toBeNull();
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('content-length')).toBeNull();
  });
});
