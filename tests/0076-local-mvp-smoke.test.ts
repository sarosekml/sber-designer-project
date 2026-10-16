import { describe, expect, test } from 'bun:test';

import {
  buildEndpointChecks,
  extractWebBuildSha,
  formatManualSmokeChecklist,
  parseCurlProbeOutput,
  resolveSmokeConfig,
  runBuildParityCheck,
  shouldCheckEndpoints,
} from '../scripts/local-mvp-smoke';

describe('0076 local MVP smoke helper', () => {
  test('resolves default local MVP service URLs', () => {
    const config = resolveSmokeConfig({});

    expect(config.webUrl).toBe('http://localhost:5173');
    expect(config.apiUrl).toBe('http://localhost:3000');
    expect(config.sandboxUrl).toBe('http://localhost:3001');
    expect(config.user).toBe('local-smoke');
    expect(config.serviceToken).toBeUndefined();
  });

  test('normalizes overridden URLs and builds deterministic endpoint checks', () => {
    const config = resolveSmokeConfig({
      SBER_DESIGNER_SMOKE_WEB_URL: 'http://127.0.0.1:5174/',
      VITE_API_URL: 'http://127.0.0.1:3010/',
      SBER_DESIGNER_SANDBOX_URL: 'http://127.0.0.1:3011/',
      SBER_DESIGNER_SMOKE_USER: 'ada',
    });

    expect(buildEndpointChecks(config)).toEqual([
      {
        label: 'web editor',
        url: 'http://127.0.0.1:5174/',
        expectText: '<html',
      },
      {
        label: 'api health',
        url: 'http://127.0.0.1:3010/health',
        expectJson: { ok: true },
      },
      {
        label: 'api authenticated config',
        url: 'http://127.0.0.1:3010/api/config',
        headers: { 'x-sber-designer-user': 'ada' },
      },
      {
        label: 'sandbox health',
        url: 'http://127.0.0.1:3011/health',
        expectJson: { ok: true },
      },
    ]);
  });

  test('uses the dedicated service token for protected password-mode probes', () => {
    const config = resolveSmokeConfig({ SBER_DESIGNER_SMOKE_SERVICE_TOKEN: 'secret-token' });
    const protectedCheck = buildEndpointChecks(config).find(
      (check) => check.label === 'api authenticated config',
    );
    expect(protectedCheck?.headers).toEqual({
      'x-sber-designer-service-token': 'secret-token',
    });
  });

  test('manual checklist covers the MVP-critical product flow', () => {
    const checklist = formatManualSmokeChecklist(resolveSmokeConfig({}));

    expect(checklist).toContain('1. Open http://localhost:5173');
    expect(checklist).toContain('2. Open or register a local project');
    expect(checklist).toContain('3. Start preview');
    expect(checklist).toContain('4. Create a blank screen in Ungrouped');
    expect(checklist).toContain('5. Run the mock assistant write flow');
    expect(checklist).toContain('6. Switch Interact -> Design -> Code');
    expect(checklist).toContain('7. Open Flow');
    expect(checklist).toContain('8. Create a Modal screen');
    expect(checklist).toContain('9. Wire a click edge into the modal');
    expect(checklist).toContain('10. Check git status');
    expect(checklist).toContain('SBER_DESIGNER_SMOKE_SERVICE_TOKEN');
  });

  test('parses curl probe output with body and trailing status code', () => {
    expect(parseCurlProbeOutput('{"ok":true}\n200')).toEqual({
      ok: true,
      status: 200,
      body: '{"ok":true}',
    });

    expect(parseCurlProbeOutput('not found\n404')).toEqual({
      ok: false,
      status: 404,
      body: 'not found',
    });

    test('extracts the web build marker regardless of attribute order', () => {
      expect(
        extractWebBuildSha(
          '<html><head><meta content="abc123" data-extra="1" name="sber-designer-build"></head></html>',
        ),
      ).toBe('abc123');
      expect(extractWebBuildSha('<html><head></head></html>')).toBeUndefined();
    });

    test('passes only when web and api report the same build sha', async () => {
      const config = resolveSmokeConfig({});
      const responses = new Map([
        [
          'http://localhost:5173/',
          {
            ok: true,
            status: 200,
            body: '<html><head><meta name="sber-designer-build" content="abc123"></head></html>',
          },
        ],
        [
          'http://localhost:3000/api/version',
          {
            ok: true,
            status: 200,
            body: JSON.stringify({
              version: '0.2.0-beta.1',
              gitSha: 'abc123',
              buildTime: '2026-07-09T12:00:00.000Z',
            }),
          },
        ],
      ]);
      const result = await runBuildParityCheck(config, async (url) => {
        return responses.get(url) ?? { ok: false, body: '', detail: `Unexpected URL: ${url}` };
      });

      expect(result.ok).toBe(true);
      expect(result.detail).toContain('abc123');
    });

    test('reports a stale web bundle when build shas differ', async () => {
      const config = resolveSmokeConfig({});
      const result = await runBuildParityCheck(config, async (url) => {
        if (url.includes('/api/version')) {
          return {
            ok: true,
            status: 200,
            body: JSON.stringify({
              version: '0.2.0-beta.1',
              gitSha: 'api-sha',
              buildTime: '2026-07-09T12:00:00.000Z',
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          body: '<meta name="sber-designer-build" content="web-sha">',
        };
      });

      expect(result.ok).toBe(false);
      expect(result.detail).toBe('Build mismatch: api=api-sha, web=web-sha');
    });
  });

  test('keeps endpoint probes opt-in for Bun sandbox compatibility', () => {
    expect(shouldCheckEndpoints({})).toBe(false);
    expect(shouldCheckEndpoints({ SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS: '0' })).toBe(false);
    expect(shouldCheckEndpoints({ SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS: 'true' })).toBe(true);
    expect(shouldCheckEndpoints({ SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS: '1' })).toBe(true);
  });
});
