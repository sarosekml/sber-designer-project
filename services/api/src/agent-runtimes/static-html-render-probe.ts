import { classifyCanvasRuntimeHealth, type CanvasRuntimeHealth } from './render-health';

export interface StaticHtmlRenderProbeInput {
  url: string;
  fetchImpl?: typeof fetch | undefined;
  sourceMarkerFound?: boolean | undefined;
  sourcePath?: string | undefined;
  sourceHash?: string | undefined;
  storyId?: string | undefined;
}

export async function probeStaticHtmlRender(
  input: StaticHtmlRenderProbeInput,
): Promise<CanvasRuntimeHealth> {
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(input.url);
  } catch (err) {
    return {
      status: 'unavailable',
      evidenceSource: 'static-html-http',
      weakEvidence: true,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  if (!response.ok) {
    return {
      status: 'unavailable',
      evidenceSource: 'static-html-http',
      weakEvidence: true,
      httpStatus: response.status,
      reasonCode: 'preview_unavailable',
      reason: `Static HTML preview returned HTTP ${response.status}.`,
    };
  }

  const html = await response.text();
  const consoleErrors = await collectStaticScriptErrors(input.url, html, fetchImpl);
  const health = classifyCanvasRuntimeHealth({
    rootFound: /\bdata-sd-screen-root\b/u.test(html),
    bodyText: stripHtml(html),
    consoleErrors,
    evidenceJsCapable: true,
    sourceMarkerFound: input.sourceMarkerFound,
    sourcePath: input.sourcePath,
    sourceHash: input.sourceHash,
    storyId: input.storyId,
    domSnapshot: stripHtml(html),
  });
  return {
    ...health,
    evidenceSource: 'static-html-http',
    weakEvidence: health.weakEvidence ?? health.status !== 'failed',
  };
}

async function collectStaticScriptErrors(
  url: string,
  html: string,
  fetchImpl: typeof fetch,
): Promise<string[]> {
  const errors = [...extractScriptErrorEvidence(html)];
  const scriptSrcs = Array.from(html.matchAll(/<script\b[^>]*\ssrc\s*=\s*(['"])(.*?)\1[^>]*>/giu))
    .map((match) => match[2]?.trim())
    .filter((src): src is string => Boolean(src))
    .slice(0, 20);
  for (const src of scriptSrcs) {
    try {
      const scriptUrl = new URL(src, url).toString();
      const response = await fetchImpl(scriptUrl);
      if (!response.ok) continue;
      errors.push(...extractScriptErrorEvidence(await response.text()));
    } catch {
      // Static probing is best effort; failed script fetches are covered by
      // full browser render evidence when Chrome is configured.
    }
  }
  return errors;
}

function extractScriptErrorEvidence(contents: string): string[] {
  const scripts = Array.from(contents.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/giu)).map(
    (match) => match[1] ?? '',
  );
  const candidates = scripts.length > 0 ? scripts : [contents];
  return candidates.flatMap((script) => [
    ...extractThrowErrors(script),
    ...extractConsoleErrors(script),
  ]);
}

function extractThrowErrors(script: string): string[] {
  return Array.from(
    script.matchAll(
      /\bthrow\s+new\s+(Error|TypeError|ReferenceError|SyntaxError)\s*\(([^)]*)\)/giu,
    ),
  ).map((match) => {
    const errorName = match[1] ?? 'Error';
    const message = literalArgument(match[2] ?? '') ?? 'Static script throws during preview.';
    return `Uncaught ${errorName}: ${message}`;
  });
}

function extractConsoleErrors(script: string): string[] {
  return Array.from(script.matchAll(/\bconsole\.error\s*\(([^)]*)\)/giu))
    .map((match) => literalArgument(match[1] ?? '') ?? null)
    .filter((message): message is string => Boolean(message))
    .map((message) => `Console error: ${message}`);
}

function literalArgument(value: string): string | null {
  const match = /^\s*(['"`])([\s\S]*?)\1\s*$/u.exec(value.trim());
  return match?.[2]?.replace(/\\(['"`\\])/gu, '$1') ?? null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
