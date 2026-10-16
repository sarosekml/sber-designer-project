import { expect, test } from 'bun:test';

import { unknownToolDetail } from '../services/api/src/agent/tool-hints';

test('unknown MCP-like tool names suggest exact canonical matches', () => {
  const detail = unknownToolDetail('mcp__talk-to-pixso-mcp__connect-to-pixso', [
    'mcp__talk_to_pixso_mcp__connect_to_pixso',
    'list_product_mcp_tools',
  ]);

  expect(detail).toContain('mcp__talk_to_pixso_mcp__connect_to_pixso');
  expect(detail).toContain('Use exact MCP tool names');
});

test('unknown MCP-like tool names point to the broker before guessing', () => {
  const detail = unknownToolDetail('talk-to-pixso-mcp--get_design_context', [
    'list_product_mcp_tools',
    'call_product_mcp_tool',
  ]);

  expect(detail).toContain('list_product_mcp_tools');
  expect(detail).toContain('before guessing MCP tool names');
});

test('ordinary unknown tool names keep the compact default message', () => {
  expect(unknownToolDetail('totally_missing', ['read_file'])).toBe(
    'No tool named "totally_missing"',
  );
});
