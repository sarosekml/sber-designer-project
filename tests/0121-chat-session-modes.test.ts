import { expect, test } from 'bun:test';
import { z } from 'zod';
import { normalizeAssistantSessionMode } from '@sber-designer/shared-types';

import {
  filterToolsForSessionMode,
  isPlanDocumentPath,
  sessionModeEnforcementForRuntime,
  sessionModePromptSection,
} from '../services/api/src/session-mode';
import type { ServerTool } from '../services/api/src/agent/types';

const tool = (name: string): ServerTool => ({
  name,
  description: name,
  inputSchema: z.object({}),
  handler: async () => ({ ok: true }),
});

test('0121 legacy sessions normalize to Design', () => {
  expect(normalizeAssistantSessionMode(undefined)).toBe('design');
  expect(normalizeAssistantSessionMode('ask')).toBe('ask');
  expect(normalizeAssistantSessionMode('plan')).toBe('plan');
});

test('0121 Ask is read-only and Plan can only write a plan document', () => {
  const tools = [
    tool('read_file'),
    tool('write_file'),
    tool('apply_patch'),
    tool('apply_project_restructure'),
    tool('set_mode'),
  ];
  expect(filterToolsForSessionMode(tools, 'ask').map((item) => item.name)).toEqual(['read_file']);
  expect(filterToolsForSessionMode(tools, 'plan').map((item) => item.name)).toEqual([
    'read_file',
    'write_file',
  ]);
  expect(filterToolsForSessionMode(tools, 'design').map((item) => item.name)).toEqual([
    'read_file',
    'write_file',
    'apply_patch',
    'apply_project_restructure',
    'set_mode',
  ]);
});

test('0121 Plan path guard rejects source files and traversal', () => {
  expect(isPlanDocumentPath('.sber-designer/plans/0121-checkout.plan.md')).toBe(true);
  expect(isPlanDocumentPath('./.sber-designer/plans/0121-checkout.md')).toBe(true);
  expect(isPlanDocumentPath('.sber-designer/plans/../project.sdproj')).toBe(false);
  expect(isPlanDocumentPath('src/screens/Checkout.tsx')).toBe(false);
});

test('0121 Plan hands exact component hydration to Design and CLI enforcement is explicit', () => {
  const prompt = sessionModePromptSection('plan');
  expect(prompt).toContain('Build the screen or flow structure');
  expect(prompt).toContain('Do not hydrate or assume final variants here');
  expect(prompt).toContain('Design revalidates the component map');
  expect(sessionModeEnforcementForRuntime({ sessionMode: 'ask', targetKind: 'api' })).toBe(
    'native',
  );
  expect(sessionModeEnforcementForRuntime({ sessionMode: 'plan', targetKind: 'cli' })).toBe(
    'promptOnly',
  );
});
