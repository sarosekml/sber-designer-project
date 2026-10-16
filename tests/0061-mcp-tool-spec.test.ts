import { expect, test } from 'bun:test';
import { z } from 'zod';

import { toolToSpec } from '../services/api/src/agent/tool-spec';
import type { ServerTool } from '../services/api/src/agent/types';

test('toolToSpec uses explicit JSON Schema parameters for MCP tools', () => {
  const parametersJsonSchema = {
    type: 'object',
    properties: {
      nodeId: { type: 'string' },
    },
    required: ['nodeId'],
    additionalProperties: false,
  };
  const tool: ServerTool = {
    name: 'mcp__talk_to_pixso__get_node_info',
    description: 'Read Pixso node info.',
    inputSchema: z.unknown(),
    parametersJsonSchema,
    handler: async () => ({ ok: true }),
  };

  expect(toolToSpec(tool)).toEqual({
    name: 'mcp__talk_to_pixso__get_node_info',
    description: 'Read Pixso node info.',
    parameters: parametersJsonSchema,
  });
});

test('toolToSpec falls back to zod schema for internal tools', () => {
  const tool: ServerTool = {
    name: 'read_file',
    description: 'Read file.',
    inputSchema: z
      .object({
        path: z.string().min(1),
      })
      .strict(),
    handler: async () => ({ ok: true }),
  };

  const spec = toolToSpec(tool);

  expect(spec.name).toBe('read_file');
  expect(spec.description).toBe('Read file.');
  expect(spec.parameters.type).toBe('object');
  expect((spec.parameters.properties as Record<string, unknown>).path).toBeTruthy();
});
