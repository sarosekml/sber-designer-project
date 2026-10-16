#!/usr/bin/env node
/**
 * CLI entry point for the proj-mcp server.
 *
 *   sber-designer-mcp                          # stdio (default)
 *   sber-designer-mcp --workspace /path/to/repo
 *   sber-designer-mcp --project-id my-project
 *
 *   sber-designer-mcp --http --token <secret>  # HTTP transport (Phase 1.9)
 *   sber-designer-mcp --http --port 3030 --token <secret>
 *
 * Designed to be invoked by external MCP clients (Claude Code, Cursor)
 * via their `mcpServers` config — see docs/integrations/connect-claude-code.md.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';

import { createHttpBridge } from './bridge';
import { makeContext } from './context';
import { createHttpServer } from './http-server';
import { createMcpServer } from './server';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    workspace: { type: 'string' },
    'project-id': { type: 'string' },
    'api-url': { type: 'string' },
    'service-token': { type: 'string' },
    'run-id': { type: 'string' },
    http: { type: 'boolean', default: false },
    port: { type: 'string' },
    token: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: false,
});

if (values.help) {
  process.stdout.write(
    'Usage: sber-designer-mcp [--workspace <dir>] [--project-id <id>] [--api-url <url>]\n' +
      '                         [--service-token <token>]\n' +
      '                         [--http] [--port <n>] [--token <bearer>]\n' +
      '\n' +
      'Default transport is stdio, meant to be launched by an MCP client\n' +
      '(Claude Code, Cursor, OpenCode, Codex CLI).\n' +
      '\n' +
      'With --http, starts a tiny REST surface (GET /mcp/tools, POST /mcp/call)\n' +
      'guarded by a bearer token. Useful for CI / non-MCP clients today; the\n' +
      'MCP-spec Streamable HTTP transport will replace it in Phase 4.\n' +
      '\n' +
      '--token may also come from SBER_DESIGNER_MCP_TOKEN.\n' +
      '--api-url (or SBER_DESIGNER_API_URL) wires editor_* tools through\n' +
      'services/api so they affect the running editor.\n' +
      '--service-token may also come from SBER_DESIGNER_SERVICE_TOKEN.\n',
  );
  process.exit(0);
}

const apiUrl = values['api-url'] ?? process.env.SBER_DESIGNER_API_URL ?? null;
const serviceToken = values['service-token'] ?? process.env.SBER_DESIGNER_SERVICE_TOKEN;
const workspaceRoot = resolve(values.workspace ?? process.cwd());
const bridge = apiUrl
  ? createHttpBridge({
      apiUrl,
      workspacePath: workspaceRoot,
      ...(serviceToken ? { serviceToken } : {}),
    })
  : null;

const ctx = makeContext({
  workspaceRoot,
  bridge,
  // `exactOptionalPropertyTypes` — an absent flag must be an absent key, not
  // an explicit `undefined`, or the optional-property contract is broken.
  ...(values['project-id'] ? { projectId: values['project-id'] } : {}),
  ...(values['run-id'] ? { runId: values['run-id'] } : {}),
});

if (values.http) {
  const token = values.token ?? process.env.SBER_DESIGNER_MCP_TOKEN ?? '';
  if (!token) {
    process.stderr.write(
      '[proj-mcp] --http requires --token (or SBER_DESIGNER_MCP_TOKEN). Anonymous HTTP is disabled.\n',
    );
    process.exit(2);
  }
  const port = Number(values.port ?? process.env.PORT ?? 3030);
  const app = createHttpServer({ context: ctx, token });

  // Bun-style export-default-of-{port,fetch} works at the top level only —
  // here we explicitly start a Bun.serve so this also works under ts-node
  // / node + the polyfill if anyone runs it.
  const bun = (
    globalThis as unknown as {
      Bun?: { serve: (init: { port: number; fetch: typeof app.fetch }) => unknown };
    }
  ).Bun;
  if (bun) {
    bun.serve({ port, fetch: app.fetch });
  } else {
    process.stderr.write(
      '[proj-mcp] --http needs the Bun runtime today. Run via `bun src/bin.ts --http ...`.\n',
    );
    process.exit(2);
  }
  process.stderr.write(
    `[proj-mcp] http listening on http://localhost:${port}/mcp · project=${ctx.projectId} · workspace=${ctx.workspaceRoot} · bridge=${apiUrl ?? 'none'}\n`,
  );
} else {
  const server = createMcpServer({ context: ctx });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[proj-mcp] stdio ready · project=${ctx.projectId} · workspace=${ctx.workspaceRoot} · bridge=${apiUrl ?? 'none'}\n`,
  );
}
