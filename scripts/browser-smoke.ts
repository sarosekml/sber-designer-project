#!/usr/bin/env bun
/**
 * `bun run smoke:browser` — the local browser suite from 0136 R13.
 *
 * Boots api + sandbox + the built web app on free ports with the offline mock
 * provider, drives real Chromium, and asserts the scenarios the endpoint
 * probes and source-string tests cannot reach:
 *
 *   1. Home renders without pulling Monaco or the editor graph (R14).
 *   2. A connected HTML-first project opens in the editor.
 *   3. Interact / Design / Code share ONE sandbox iframe — switching modes
 *      must not recreate it (ADR-0004).
 *   4. The Code view loads Monaco on demand, from local assets, no CDN.
 *   5. A mock generation run streams a full SSE lifecycle to completion.
 *   6. An aborted run closes cleanly and the api keeps answering.
 *   7. Project state survives a reload (project-owned `.sdproj`, 0136 R08).
 *
 * Exits non-zero on the first failure and prints what it saw.
 */
import {
  chromiumAvailable,
  seedHtmlProject,
  skipNotice,
  startStack,
} from '../tests/browser/harness';

interface Step {
  name: string;
  run: (ctx: SmokeContext) => Promise<void>;
}

interface SmokeContext {
  page: import('playwright').Page;
  webUrl: string;
  apiUrl: string;
  workspace: string;
  /** Network requests the page made, in order. */
  requests: string[];
  /** Bytes of JavaScript the page actually downloaded, by URL. */
  scriptBytes: Map<string, number>;
}

/**
 * Budget for the JavaScript Home downloads before anything is clicked.
 *
 * Measured at 0136 R14: 854 kB raw / 243 kB gzip, down from 5,608 kB / 1,498
 * kB when main.tsx imported Monaco and App.tsx imported EditorShell eagerly.
 * The budget sits between the two, so re-eagering either one fails here even
 * though the chunk would no longer be named "monaco" or "CodeView".
 */
const HOME_SCRIPT_BUDGET_BYTES = 1_500_000;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const STEPS: Step[] = [
  {
    name: 'Home renders without the editor or Monaco graph',
    async run({ page, webUrl, requests, scriptBytes }) {
      await page.goto(webUrl, { waitUntil: 'networkidle' });
      await page.waitForSelector('body');

      const monacoRequests = requests.filter(
        (url) => /monaco/iu.test(url) || /CodeView-/u.test(url),
      );
      assert(
        monacoRequests.length === 0,
        `Home pulled the editor graph: ${monacoRequests.slice(0, 3).join(', ')}`,
      );

      const externalCdn = requests.filter((url) => /cdn\.jsdelivr\.net|unpkg\.com/u.test(url));
      assert(externalCdn.length === 0, `Home reached a public CDN: ${externalCdn.join(', ')}`);

      const total = [...scriptBytes.values()].reduce((sum, bytes) => sum + bytes, 0);
      const largest = [...scriptBytes.entries()].sort((a, b) => b[1] - a[1])[0];
      assert(
        total <= HOME_SCRIPT_BUDGET_BYTES,
        `Home downloaded ${Math.round(total / 1024)} kB of JavaScript, budget is ` +
          `${Math.round(HOME_SCRIPT_BUDGET_BYTES / 1024)} kB. ` +
          `Largest chunk: ${largest?.[0]} (${Math.round((largest?.[1] ?? 0) / 1024)} kB). ` +
          'Something the editor pulls in is being imported eagerly again (0136 R14).',
      );
      console.log(
        `        Home JS: ${Math.round(total / 1024)} kB across ${scriptBytes.size} file(s)`,
      );
    },
  },
  {
    name: 'a connected HTML-first project opens in the editor',
    async run({ page, webUrl, apiUrl, workspace }) {
      const registered = await page.evaluate(
        async ([api, ws]) => {
          const response = await fetch(`${api}/api/projects`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-sber-designer-user': 'smoke' },
            body: JSON.stringify({ workspacePath: ws }),
          });
          return { status: response.status, body: await response.text() };
        },
        [apiUrl, workspace] as const,
      );
      assert(
        registered.status < 400,
        `register failed: ${registered.status} ${registered.body.slice(0, 200)}`,
      );
      const entry = JSON.parse(registered.body) as { entry?: { id?: string }; id?: string };
      const projectId = entry.entry?.id ?? entry.id;
      assert(projectId, `register returned no project id: ${registered.body.slice(0, 200)}`);

      await page.goto(`${webUrl}/edit/${projectId}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('iframe', { timeout: 60_000 });
    },
  },
  {
    name: 'Interact / Design / Code share one sandbox iframe',
    async run({ page }) {
      const iframeIdentity = () =>
        page.evaluate(() => {
          const frame = document.querySelector('iframe');
          if (!frame) return null;
          const marked = frame as HTMLIFrameElement & { __sdSmokeId?: string };
          marked.__sdSmokeId ??= `iframe-${Math.random().toString(36).slice(2)}`;
          return marked.__sdSmokeId;
        });

      const before = await iframeIdentity();
      assert(before, 'no canvas iframe found in Interact mode');

      // The mode switch is a Radix Tabs list: role="tab", not "button".
      for (const label of ['Design', 'Code', 'Interact']) {
        const tab = page.getByRole('tab', { name: label, exact: true }).first();
        assert((await tab.count()) > 0, `mode tab "${label}" not found`);
        await tab.click();
        await page.waitForTimeout(600);
        const after = await iframeIdentity();
        assert(
          after === before,
          `switching to ${label} recreated the sandbox iframe (${before} -> ${after})`,
        );
      }
    },
  },
  {
    name: 'Code mode loads Monaco on demand, from local assets',
    async run({ page, requests }) {
      const codeTab = page.getByRole('tab', { name: 'Code', exact: true }).first();
      assert((await codeTab.count()) > 0, 'Code mode tab not found');
      await codeTab.click();
      await page.waitForTimeout(2500);
      const monacoRequests = requests.filter(
        (url) => /monaco/iu.test(url) || /CodeView-/u.test(url),
      );
      assert(monacoRequests.length > 0, 'Code mode did not load the Monaco chunk');
      const remote = monacoRequests.filter((url) => !url.includes('127.0.0.1'));
      assert(remote.length === 0, `Monaco was fetched from outside the app: ${remote.join(', ')}`);
    },
  },
  {
    name: 'a mock generation run streams a full SSE lifecycle',
    async run({ page, apiUrl, workspace }) {
      const result = await page.evaluate(
        async ([api, ws]) => {
          const response = await fetch(`${api}/api/chat/stream`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: 'Say hello and stop.' }],
              provider: 'mock',
              model: 'echo',
              editorContext: { workspacePath: ws, projectName: 'smoke-project' },
            }),
          });
          if (!response.ok || !response.body) {
            return { status: response.status, events: [], text: await response.text() };
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          const events: string[] = [];
          let buffer = '';
          const deadline = Date.now() + 60_000;
          while (Date.now() < deadline) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            // Frames are `data: {json}` with a `type` field — the stream does
            // not use named SSE `event:` lines.
            let index = buffer.indexOf('\n\n');
            while (index !== -1) {
              const frame = buffer.slice(0, index);
              buffer = buffer.slice(index + 2);
              for (const part of frame.split('\n')) {
                if (!part.startsWith('data:')) continue;
                try {
                  const parsed = JSON.parse(part.slice('data:'.length).trim());
                  if (typeof parsed?.type === 'string') events.push(parsed.type);
                } catch {
                  // a non-JSON keepalive frame
                }
              }
              index = buffer.indexOf('\n\n');
            }
            if (events.includes('done') || events.includes('error')) break;
          }
          await reader.cancel().catch(() => undefined);
          return { status: response.status, events, text: '' };
        },
        [apiUrl, workspace] as const,
      );

      assert(
        result.status === 200,
        `chat stream returned ${result.status}: ${result.text.slice(0, 200)}`,
      );
      assert(result.events.length > 0, 'chat stream produced no SSE events');
      const seen = [...new Set(result.events)];
      assert(
        result.events.includes('run-started'),
        `chat stream never announced a run. Events: ${seen.join(', ') || '(none)'}`,
      );
      assert(
        result.events.includes('text-delta'),
        `chat stream produced no assistant text. Events: ${seen.join(', ')}`,
      );
      assert(
        result.events.includes('done'),
        `chat stream never completed. Events: ${seen.join(', ')}`,
      );
      console.log(`        SSE events: ${seen.join(', ')}`);
    },
  },
  {
    name: 'an aborted run closes its stream without leaving the api stuck',
    async run({ page, apiUrl, workspace }) {
      // Cancel mid-stream, then prove the api still answers: a leaked run
      // lock or an unclosed SSE writer would show up as the next request
      // hanging rather than as an error.
      const result = await page.evaluate(
        async ([api, ws]) => {
          const controller = new AbortController();
          const streaming = fetch(`${api}/api/chat/stream`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              messages: [{ role: 'user', content: 'Start something long.' }],
              provider: 'mock',
              model: 'echo',
              editorContext: { workspacePath: ws, projectName: 'smoke-project' },
            }),
          }).catch(() => null);
          setTimeout(() => controller.abort(), 250);
          await streaming;
          const after = await fetch(`${api}/api/version`, {
            signal: AbortSignal.timeout(10_000),
          });
          return { status: after.status };
        },
        [apiUrl, workspace] as const,
      );
      assert(result.status === 200, `api did not recover after an abort: ${result.status}`);
    },
  },
  {
    name: 'project state survives a reload',
    async run({ page, apiUrl, workspace }) {
      const read = async () =>
        page.evaluate(
          async ([api, ws]) => {
            const response = await fetch(
              `${api}/api/project?workspacePath=${encodeURIComponent(ws)}`,
              { headers: { 'x-sber-designer-user': 'smoke' } },
            );
            return { status: response.status, etag: response.headers.get('etag') };
          },
          [apiUrl, workspace] as const,
        );
      const first = await read();
      assert(first.status === 200, `GET /api/project returned ${first.status}`);
      await page.reload({ waitUntil: 'networkidle' });
      const second = await read();
      assert(second.status === 200, `GET /api/project after reload returned ${second.status}`);
      assert(
        first.etag === second.etag,
        `project revision changed across a reload: ${first.etag} -> ${second.etag}`,
      );
    },
  },
];

async function main(): Promise<void> {
  if (!(await chromiumAvailable())) {
    console.log(skipNotice());
    process.exit(0);
  }

  const { chromium } = await import('playwright');
  const workspace = await seedHtmlProject();
  const stack = await startStack({ workspace });
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests: string[] = [];
  const scriptBytes = new Map<string, number>();
  page.on('request', (request) => requests.push(request.url()));
  page.on('response', (response) => {
    if (!/\.js(\?|$)/u.test(response.url())) return;
    void response
      .body()
      .then((body) => scriptBytes.set(response.url(), body.length))
      .catch(() => undefined);
  });

  const ctx: SmokeContext = {
    page,
    webUrl: stack.webUrl,
    // Same-origin, exactly like the app: the smoke web server proxies /api
    // the way nginx does in a deployment.
    apiUrl: stack.webUrl,
    workspace,
    requests,
    scriptBytes,
  };

  console.log('Browser smoke (0136 R13)');
  console.log(`web=${stack.webUrl} api=${stack.apiUrl}`);
  console.log(`workspace=${workspace}\n`);

  let failed = false;
  for (const step of STEPS) {
    try {
      await step.run(ctx);
      console.log(`  ok    ${step.name}`);
    } catch (error) {
      failed = true;
      console.log(`  FAIL  ${step.name}`);
      console.log(`        ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
  }

  await browser.close();
  await stack.stop();
  console.log(failed ? '\nBrowser smoke failed.' : '\nBrowser smoke passed.');
  process.exit(failed ? 1 : 0);
}

if (import.meta.main) {
  await main();
}
