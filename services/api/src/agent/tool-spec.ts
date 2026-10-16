import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolSpec } from '@sber-designer/llm-gateway';

import type { ServerTool } from './types';

export function toolToSpec(tool: ServerTool): ToolSpec {
  return {
    name: tool.name,
    description: tool.description,
    parameters:
      tool.parametersJsonSchema ??
      (zodToJsonSchema(tool.inputSchema, { target: 'jsonSchema7' }) as Record<string, unknown>),
  };
}
