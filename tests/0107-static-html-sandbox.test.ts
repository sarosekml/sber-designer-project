import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  readStaticHtmlPreviewResponse,
  StaticHtmlSession,
} from '../services/sandbox/src/static-html-session';
import { pickFreePort } from '../services/sandbox/src/session';

async function createStaticHtmlWorkspace() {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-static-html-'));
  await mkdir(join(workspace, 'pages'), { recursive: true });
  await writeFile(
    join(workspace, 'pages', 'home.html'),
    [
      '<!doctype html>',
      '<html lang="en">',
      '<head><title>Home</title></head>',
      '<body>',
      '<main class="hero">',
      '<h1>Hello</h1>',
      '</main>',
      '</body>',
      '</html>',
    ].join('\n'),
    'utf8',
  );
  await writeFile(join(workspace, 'pages', 'styles.css'), '.hero { color: red; }', 'utf8');
  return workspace;
}

test('static html preview response injects source loc and screen root marker', async () => {
  const workspace = await createStaticHtmlWorkspace();

  const htmlResponse = await readStaticHtmlPreviewResponse(workspace, '/pages/home.html');
  expect(htmlResponse.status).toBe(200);
  expect(htmlResponse.headers['content-type']).toBe('text/html; charset=utf-8');

  const html = htmlResponse.body.toString();
  expect(html).toContain('<body data-sd-screen-root');
  expect(html).toContain('data-sd-loc="pages/home.html:5"');
  expect(html).toContain('window.__SBER_DESIGNER_STATIC_HTML__');

  const cssResponse = await readStaticHtmlPreviewResponse(workspace, '/pages/styles.css');
  expect(cssResponse.status).toBe(200);
  expect(cssResponse.headers['content-type']).toBe('text/css; charset=utf-8');
  expect(cssResponse.body.toString()).toBe(
    await readFile(join(workspace, 'pages', 'styles.css'), 'utf8'),
  );
});

const canBindLoopback = await loopbackBindingAvailable();
const networkTest = canBindLoopback ? test : test.skip;

networkTest('static html sandbox serves workspace html over loopback HTTP', async () => {
  const workspace = await createStaticHtmlWorkspace();
  const session = new StaticHtmlSession(workspace, await pickFreePort());
  await session.start();
  try {
    const html = await fetch(`${session.previewUrl}/pages/home.html`).then((res) => res.text());
    expect(html).toContain('<body data-sd-screen-root');
    expect(html).toContain('data-sd-loc="pages/home.html:5"');
    expect(html).toContain('window.__SBER_DESIGNER_STATIC_HTML__');

    const css = await fetch(`${session.previewUrl}/pages/styles.css`).then((res) => res.text());
    expect(css).toBe(await readFile(join(workspace, 'pages', 'styles.css'), 'utf8'));
  } finally {
    await session.stop();
  }
});

async function loopbackBindingAvailable(): Promise<boolean> {
  return new Promise<boolean>((resolveAvailability, rejectAvailability) => {
    const server = createServer();
    server.unref();
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        resolveAvailability(false);
        return;
      }
      rejectAvailability(error);
    });
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolveAvailability(true));
    });
  });
}
