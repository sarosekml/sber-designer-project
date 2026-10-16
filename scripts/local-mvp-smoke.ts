#!/usr/bin/env bun

export interface SmokeConfig {
  webUrl: string;
  apiUrl: string;
  sandboxUrl: string;
  user: string;
  serviceToken: string | undefined;
}

export interface EndpointCheck {
  label: string;
  url: string;
  expectText?: string;
  expectJson?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface EndpointResult {
  check: EndpointCheck;
  ok: boolean;
  status?: number;
  detail: string;
}

export interface ProbeResponse {
  ok: boolean;
  status?: number;
  body: string;
  detail?: string;
}

type Env = Record<string, string | undefined>;
export type Probe = (url: string, headers?: Record<string, string>) => Promise<ProbeResponse>;

const BUILD_MARKER_META_NAME = 'sber-designer-build';

export function resolveSmokeConfig(env: Env = process.env): SmokeConfig {
  return {
    webUrl: normalizeBaseUrl(env.SBER_DESIGNER_SMOKE_WEB_URL, 'http://localhost:5173'),
    apiUrl: normalizeBaseUrl(
      env.SBER_DESIGNER_SMOKE_API_URL ?? env.VITE_API_URL,
      'http://localhost:3000',
    ),
    sandboxUrl: normalizeBaseUrl(env.SBER_DESIGNER_SANDBOX_URL, 'http://localhost:3001'),
    user: env.SBER_DESIGNER_SMOKE_USER?.trim() || 'local-smoke',
    serviceToken: env.SBER_DESIGNER_SMOKE_SERVICE_TOKEN?.trim() || undefined,
  };
}

export function buildEndpointChecks(config: SmokeConfig): EndpointCheck[] {
  const apiAuthHeaders = config.serviceToken
    ? { 'x-sber-designer-service-token': config.serviceToken }
    : { 'x-sber-designer-user': config.user };
  return [
    {
      label: 'web editor',
      url: withPath(config.webUrl, '/'),
      expectText: '<html',
    },
    {
      label: 'api health',
      url: withPath(config.apiUrl, '/health'),
      expectJson: { ok: true },
    },
    {
      label: 'api authenticated config',
      url: withPath(config.apiUrl, '/api/config'),
      headers: apiAuthHeaders,
    },
    {
      label: 'sandbox health',
      url: withPath(config.sandboxUrl, '/health'),
      expectJson: { ok: true },
    },
  ];
}

export function shouldCheckEndpoints(env: Env = process.env): boolean {
  const value = env.SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function formatManualSmokeChecklist(config: SmokeConfig): string {
  return [
    'Manual MVP flow:',
    `1. Open ${config.webUrl} and confirm the editor shell loads.`,
    '2. Open or register a local project from Projects Home.',
    '3. Start preview and confirm the canvas iframe renders without a blank/unhealthy overlay.',
    '4. Create a blank screen in Ungrouped and confirm it appears in Screens.',
    '5. Run the mock assistant write flow and confirm screen health/status changes without external LLMs.',
    '6. Switch Interact -> Design -> Code and confirm the iframe is not restarted between mode changes.',
    '7. Open Flow and confirm the screen node is visible.',
    '8. Create a Modal screen (New screen dialog -> Modal, Width 300px / Height 50%); confirm the Modal badge in Screens and the canvas shows a scrim + centered dialog.',
    '9. Wire a click edge into the modal; in Interact confirm it opens as a transparent overlay over the live source screen, Esc/close-chip dismiss it, and a Modal-panel size edit (Design mode) rewrites 1-2 lines without an LLM run.',
    '10. Check git status and confirm project-owned source/.sber-designer changes are visible.',
    '',
    'Expected local-only evidence:',
    '- no provider API key is required for the mock flow;',
    '- password-mode endpoint probes use SBER_DESIGNER_SMOKE_SERVICE_TOKEN;',
    '- temp logs, root screenshots, and .playwright-mcp output stay uncommitted;',
    '- generated source, stories, .sdproj, and relevant design-index records are git-visible.',
  ].join('\n');
}

export async function runEndpointCheck(
  check: EndpointCheck,
  probe: Probe = curlProbe,
): Promise<EndpointResult> {
  const response = await probe(check.url, check.headers);
  if (!response.ok) {
    return {
      check,
      ok: false,
      status: response.status,
      detail: response.detail ?? `HTTP ${response.status ?? 'unknown'}`,
    };
  }

  try {
    if (check.expectJson) {
      const json = JSON.parse(response.body) as Record<string, unknown>;
      for (const [key, expected] of Object.entries(check.expectJson)) {
        if (json[key] !== expected) {
          return {
            check,
            ok: false,
            status: response.status,
            detail: `Expected JSON ${key}=${String(expected)}, got ${String(json[key])}`,
          };
        }
      }
    }

    if (check.expectText) {
      const text = response.body.toLowerCase();
      if (!text.includes(check.expectText.toLowerCase())) {
        return {
          check,
          ok: false,
          status: response.status,
          detail: `Expected response text to include ${check.expectText}`,
        };
      }
    }

    return { check, ok: true, status: response.status, detail: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      check,
      ok: false,
      status: response.status,
      detail: message,
    };
  }
}

export function extractWebBuildSha(html: string): string | undefined {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const buildTag = metaTags.find((tag) => {
    const name = tag.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1];
    return name === BUILD_MARKER_META_NAME;
  });
  return buildTag?.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() || undefined;
}

export async function runBuildParityCheck(
  config: SmokeConfig,
  probe: Probe = curlProbe,
): Promise<EndpointResult> {
  const versionUrl = withPath(config.apiUrl, '/api/version');
  const check: EndpointCheck = {
    label: 'web/api build parity',
    url: versionUrl,
  };
  const [webResponse, apiResponse] = await Promise.all([
    probe(withPath(config.webUrl, '/')),
    probe(versionUrl),
  ]);

  if (!webResponse.ok) {
    return {
      check,
      ok: false,
      status: webResponse.status,
      detail: `Cannot read the web build marker: ${webResponse.detail ?? `HTTP ${webResponse.status ?? 'unknown'}`}`,
    };
  }
  if (!apiResponse.ok) {
    return {
      check,
      ok: false,
      status: apiResponse.status,
      detail: `Cannot read /api/version: ${apiResponse.detail ?? `HTTP ${apiResponse.status ?? 'unknown'}`}`,
    };
  }

  let apiBuildInfo: Record<string, unknown>;
  try {
    apiBuildInfo = JSON.parse(apiResponse.body) as Record<string, unknown>;
  } catch {
    return {
      check,
      ok: false,
      status: apiResponse.status,
      detail: '/api/version did not return JSON',
    };
  }

  const apiGitSha =
    typeof apiBuildInfo.gitSha === 'string' ? apiBuildInfo.gitSha.trim() : undefined;
  const version =
    typeof apiBuildInfo.version === 'string' ? apiBuildInfo.version.trim() : undefined;
  const buildTime =
    typeof apiBuildInfo.buildTime === 'string' ? apiBuildInfo.buildTime.trim() : undefined;
  const webGitSha = extractWebBuildSha(webResponse.body);

  if (!apiGitSha || !version || !buildTime || Number.isNaN(Date.parse(buildTime))) {
    return {
      check,
      ok: false,
      status: apiResponse.status,
      detail: '/api/version must include non-empty gitSha, version and ISO buildTime fields',
    };
  }
  if (!webGitSha) {
    return {
      check,
      ok: false,
      status: webResponse.status,
      detail: `Web HTML is missing the ${BUILD_MARKER_META_NAME} meta marker`,
    };
  }
  if (apiGitSha === 'unknown' || webGitSha === 'unknown') {
    return {
      check,
      ok: false,
      status: apiResponse.status,
      detail: 'Build git SHA is unknown; rebuild from a git checkout or inject build metadata',
    };
  }
  if (apiGitSha !== webGitSha) {
    return {
      check,
      ok: false,
      status: apiResponse.status,
      detail: `Build mismatch: api=${apiGitSha}, web=${webGitSha}`,
    };
  }

  return {
    check,
    ok: true,
    status: apiResponse.status,
    detail: `${version} ${apiGitSha}`,
  };
}

export function parseCurlProbeOutput(output: string): ProbeResponse {
  const normalized = output.replace(/\r\n/g, '\n');
  const splitAt = normalized.lastIndexOf('\n');
  if (splitAt < 0) return { ok: false, body: normalized, detail: 'curl status marker missing' };

  const body = normalized.slice(0, splitAt);
  const status = Number(normalized.slice(splitAt + 1).trim());
  if (!Number.isInteger(status)) {
    return { ok: false, body, detail: 'curl status marker invalid' };
  }
  return { ok: status >= 200 && status < 300, status, body };
}

async function curlProbe(
  url: string,
  headers: Record<string, string> = {},
): Promise<ProbeResponse> {
  try {
    const args = ['curl', '-sS', '-L', '--max-time', '5', '-w', '\n%{http_code}'];
    for (const [name, value] of Object.entries(headers)) args.push('-H', `${name}: ${value}`);
    args.push(url);
    const child = Bun.spawn(args, {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    if (exitCode !== 0) {
      return {
        ok: false,
        body: stdout,
        detail: stderr.trim() || `curl exited with code ${exitCode}`,
      };
    }

    return parseCurlProbeOutput(stdout);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, body: '', detail: message };
  }
}

async function main(): Promise<void> {
  const config = resolveSmokeConfig();

  console.log('Local MVP smoke (0076)');
  console.log(`web=${config.webUrl}`);
  console.log(`api=${config.apiUrl}`);
  console.log(`sandbox=${config.sandboxUrl}`);
  console.log('');

  if (shouldCheckEndpoints()) {
    const checks = buildEndpointChecks(config);
    const results = await Promise.all([
      ...checks.map((check) => runEndpointCheck(check)),
      runBuildParityCheck(config),
    ]);

    for (const result of results) {
      const marker = result.ok ? 'PASS' : 'FAIL';
      const status = result.status ? ` HTTP ${result.status}` : '';
      console.log(`${marker} ${result.check.label}: ${result.check.url}${status}`);
      if (!result.ok) console.log(`  ${result.detail}`);
    }

    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      console.log('');
      console.log('Start the local MVP stack first:');
      console.log('  bun install');
      console.log('  bun run dev');
      process.exitCode = 1;
      return;
    }
    console.log('');
  } else {
    console.log('Endpoint probes: skipped');
    console.log('Set SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS=1 to probe local service URLs.');
    console.log('');
  }

  console.log(formatManualSmokeChecklist(config));
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  const url = new URL(raw);
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

function withPath(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl}/`).toString();
}

if (import.meta.main) {
  await main();
}
