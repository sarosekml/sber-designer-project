import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('config loads inside the authenticated editor shell rather than App bootstrap', async () => {
  const [app, editorShell] = await Promise.all([
    readFile('apps/web/src/App.tsx', 'utf8'),
    readFile('apps/web/src/components/editor/EditorShell.tsx', 'utf8'),
  ]);
  expect(app).not.toContain('useConfigLoader');
  expect(editorShell).toContain('useConfigLoader();');
});

test('config, SSE, and sandbox requests share the credentialed HTTP transport', async () => {
  const [http, chat, configLoader, sandboxSession] = await Promise.all([
    readFile('apps/web/src/lib/api/http.ts', 'utf8'),
    readFile('apps/web/src/lib/api/chat.ts', 'utf8'),
    readFile('apps/web/src/hooks/useConfigLoader.ts', 'utf8'),
    readFile('apps/web/src/hooks/useSandboxSession.ts', 'utf8'),
  ]);
  expect(http).toContain("credentials: 'include'");
  expect(http).toMatch(/fetchConfig[\s\S]*withSignal\(\{ headers: authHeaders\(\) \}/u);
  expect(chat).toMatch(/streamChat[\s\S]*\/api\/chat\/stream[\s\S]*withSignal\(/u);
  expect(configLoader).toContain("fetch('/sber-designer.json', withSignal({}, ac.signal))");
  expect(sandboxSession).toMatch(/fetch\([\s\S]*SANDBOX_PROXY[\s\S]*withSignal\(/u);
  expect(sandboxSession).toContain('await safeJson(res)');
});
